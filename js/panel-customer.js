const CUSTOMER_CODE = new URLSearchParams(location.search).get("code");
let currentCustomer = null;

function dueStatusClient(nextDueDate) {
  if (!nextDueDate) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 14) return "soon";
  return "ok";
}

async function loadCustomer() {
  if (!CUSTOMER_CODE) {
    document.getElementById("customer-title").textContent = "کد مشتری مشخص نشده است";
    return;
  }
  const data = await PanelAPI.getCustomer(CUSTOMER_CODE);
  if (data.error) {
    document.getElementById("customer-title").textContent = data.error;
    return;
  }
  currentCustomer = data.customer;
  renderCustomer();
}

function renderCustomer() {
  const c = currentCustomer;
  document.getElementById("customer-title").textContent = `${c.first_name} ${c.last_name}`;

  const form = document.getElementById("edit-customer-form");
  form.first_name.value = c.first_name;
  form.last_name.value = c.last_name;
  form.phone.value = c.phone || "";

  renderCars(c.cars || []);
}

function renderCars(cars) {
  const container = document.getElementById("cars-container");
  if (!cars.length) {
    container.innerHTML = `<div class="panel-card empty-state">هنوز خودرویی برای این مشتری ثبت نشده است</div>`;
    return;
  }

  container.innerHTML = cars
    .map((car) => {
      const visitsHtml = (car.visits || [])
        .map((visit) => {
          const partsHtml = (visit.parts || [])
            .map((p) => {
              const status = dueStatusClient(p.next_due_date);
              const dueText = p.next_due_date ? `موعد بعدی: ${isoToJalaliDisplay(p.next_due_date)}` : "بدون موعد";
              return `<span class="part-chip due-pill--${status}">${p.part_name} · ${dueText}
                <a href="#" onclick="event.preventDefault(); deletePart(${p.id})" style="color:inherit;">✕</a>
              </span>`;
            })
            .join("");

          return `
            <div class="visit-item">
              <div class="visit-item__date">${isoToJalaliDisplay(visit.visit_date)}
                <a href="#" onclick="event.preventDefault(); deleteVisit(${visit.id})" style="font-size:12px; color:var(--danger); margin-right:10px;">حذف مراجعه</a>
              </div>
              ${visit.complaints ? `<div class="visit-item__row"><b>ایراد اعلامی:</b> ${visit.complaints}</div>` : ""}
              ${visit.resolved ? `<div class="visit-item__row"><b>رفع‌شده:</b> ${visit.resolved}</div>` : ""}
              ${visit.notes ? `<div class="visit-item__row"><b>یادداشت:</b> ${visit.notes}</div>` : ""}
              <div class="parts-list">${partsHtml || '<span style="color:var(--gray-400); font-size:13px;">قطعه‌ای ثبت نشده</span>'}</div>
            </div>`;
        })
        .join("");

      return `
        <div class="panel-card car-card">
          <div class="panel-card__head">
            <div>
              <div class="car-card__title">${car.brand} ${car.model}</div>
              <div class="car-card__sub">${car.year ? "سال " + car.year : ""} ${car.plate ? "· پلاک " + car.plate : ""}</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary" style="padding:8px 16px; font-size:14px;" onclick="openVisitModal(${car.id})">+ ثبت مراجعه</button>
              <button class="btn-danger-ghost" onclick="deleteCar(${car.id})">حذف خودرو</button>
            </div>
          </div>
          <div class="visit-timeline">
            ${visitsHtml || '<div class="empty-state" style="padding:16px;">هنوز مراجعه‌ای ثبت نشده</div>'}
          </div>
        </div>`;
    })
    .join("");
}

// ---------- فرم ویرایش مشتری ----------
document.getElementById("edit-customer-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  await PanelAPI.updateCustomer(CUSTOMER_CODE, {
    first_name: form.first_name.value.trim(),
    last_name: form.last_name.value.trim(),
    phone: form.phone.value.trim(),
  });
  await loadCustomer();
});

// ---------- کپی لینک اختصاصی ----------
document.getElementById("copy-link-btn").addEventListener("click", () => {
  const link = `${location.origin}/customer.html?code=${CUSTOMER_CODE}`;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.getElementById("copy-link-btn");
    const original = btn.textContent;
    btn.textContent = "کپی شد ✓";
    setTimeout(() => (btn.textContent = original), 1500);
  });
});

// ---------- کمبوباکس برند/مدل خودرو ----------
let selectedBrand = null;
initCombobox(
  document.getElementById("car-brand-input"),
  document.getElementById("car-brand-list"),
  CAR_BRANDS_MODELS,
  {
    onSelect: (value) => {
      selectedBrand = value;
    },
  }
);

function modelListForBrand() {
  return selectedBrand && CAR_BRANDS_MODELS[selectedBrand] ? CAR_BRANDS_MODELS[selectedBrand] : Object.values(CAR_BRANDS_MODELS).flat();
}

const modelInput = document.getElementById("car-model-input");
const modelList = document.getElementById("car-model-list");
initCombobox(modelInput, modelList, Object.values(CAR_BRANDS_MODELS).flat(), {});
modelInput.addEventListener("focus", () => {
  // اگر برند انتخاب شده، مدل‌ها را به همان برند محدود کن
  initCombobox(modelInput, modelList, modelListForBrand(), {});
});

// ---------- فرم افزودن خودرو ----------
document.getElementById("new-car-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const brand = document.getElementById("car-brand-input").value.trim();
  const model = document.getElementById("car-model-input").value.trim();
  if (!brand || !model) return;

  const result = await PanelAPI.addCar({
    customer_code: CUSTOMER_CODE,
    brand,
    model,
    year: form.year.value.trim(),
    plate: form.plate.value.trim(),
  });
  if (result.error) {
    alert(result.error);
    return;
  }
  form.reset();
  document.getElementById("car-brand-input").value = "";
  document.getElementById("car-model-input").value = "";
  await loadCustomer();
});

async function deleteCar(id) {
  if (!confirm("این خودرو و تمام سوابق آن حذف شود؟")) return;
  await PanelAPI.deleteCar(id);
  await loadCustomer();
}

async function deleteVisit(id) {
  if (!confirm("این مراجعه حذف شود؟")) return;
  await PanelAPI.deleteVisit(id);
  await loadCustomer();
}

async function deletePart(id) {
  if (!confirm("این قطعه حذف شود؟")) return;
  await PanelAPI.deletePart(id);
  await loadCustomer();
}

// ---------- مودال ثبت مراجعه ----------
function openVisitModal(carId) {
  const modal = document.getElementById("visit-modal");
  const form = document.getElementById("new-visit-form");
  form.reset();
  form.car_id.value = carId;
  document.getElementById("parts-rows").innerHTML = "";
  addPartRow();
  modal.classList.add("open");
}

document.getElementById("close-visit-modal").addEventListener("click", () => {
  document.getElementById("visit-modal").classList.remove("open");
});

let partRowCounter = 0;
function addPartRow() {
  partRowCounter += 1;
  const rowId = `part-row-${partRowCounter}`;
  const wrap = document.createElement("div");
  wrap.className = "form-grid";
  wrap.style.marginBottom = "10px";
  wrap.id = rowId;
  wrap.innerHTML = `
    <div class="field combo">
      <label>نام قطعه</label>
      <input type="text" class="part-name-input" autocomplete="off" />
      <div class="combo-list part-name-list"></div>
    </div>
    <div class="field">
      <label>موعد تعویض بعدی (شمسی)</label>
      <input type="text" class="part-due-input" placeholder="۱۴۰۵/۰۷/۱۰ (اختیاری)" />
    </div>
  `;
  document.getElementById("parts-rows").appendChild(wrap);

  const input = wrap.querySelector(".part-name-input");
  const list = wrap.querySelector(".part-name-list");
  initCombobox(input, list, COMMON_PARTS, {});
}

document.getElementById("add-part-row-btn").addEventListener("click", addPartRow);

document.getElementById("new-visit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const visitIso = jalaliInputToIso(form.visit_date.value.trim());
  if (!visitIso) {
    alert("تاریخ مراجعه را به‌درستی وارد کنید، مثلاً ۱۴۰۵/۰۴/۲۸");
    return;
  }

  const parts = [];
  document.querySelectorAll("#parts-rows > div").forEach((row) => {
    const name = row.querySelector(".part-name-input").value.trim();
    const dueRaw = row.querySelector(".part-due-input").value.trim();
    if (!name) return;
    parts.push({
      part_name: name,
      next_due_date: dueRaw ? jalaliInputToIso(dueRaw) : null,
    });
  });

  const result = await PanelAPI.addVisit({
    car_id: form.car_id.value,
    visit_date: visitIso,
    complaints: form.complaints.value.trim(),
    resolved: form.resolved.value.trim(),
    notes: form.notes.value.trim(),
    parts,
  });

  if (result.error) {
    alert(result.error);
    return;
  }

  document.getElementById("visit-modal").classList.remove("open");
  await loadCustomer();
});

loadCustomer();
