const CUSTOMER_CODE = new URLSearchParams(location.search).get("code");
let currentCustomer = null;
let highlightVisitId = null; // شناسه آخرین مراجعه‌ی تازه ثبت‌شده، برای نشانه‌گذاری سبز موقت
let highlightPartId = null; // شناسه آخرین قطعه‌ی تازه ویرایش‌شده، برای نشانه‌گذاری سبز موقت
// توجه: dueStatusByMileage و MILEAGE_STATUS_LABEL و dueStatusCssClass از js/jalali.js می‌آیند

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
              const status = dueStatusByMileage(car.current_mileage, p.next_due_mileage);
              const dueText = p.next_due_mileage
                ? `موعد بعدی: ${formatMileageDisplay(p.next_due_mileage)} کیلومتر`
                : "بدون موعد";
              const mileageBits = [];
              if (p.replaced_at_mileage) mileageBits.push(`کارکرد تعویض: ${formatMileageDisplay(p.replaced_at_mileage)} کیلومتر`);
              const mileageHtml = mileageBits.length
                ? `<div class="part-entry__mileage">${mileageBits.join(" · ")}</div>`
                : "";
              const isPartEdited = highlightPartId !== null && Number(highlightPartId) === Number(p.id);
              return `
                <div class="part-entry">
                  <span class="part-chip due-pill--${dueStatusCssClass(status)}${isPartEdited ? " part-chip--updated" : ""}" id="part-chip-${p.id}">${p.part_name} · ${dueText}
                    <a href="#" onclick="event.preventDefault(); openEditPartModal(${p.id})" style="color:inherit; margin-left:8px;" title="ویرایش قطعه">✎</a>
                    <a href="#" onclick="event.preventDefault(); deletePart(${p.id})" style="color:inherit;" title="حذف قطعه">✕</a>
                  </span>
                  ${mileageHtml}
                </div>`;
            })
            .join("");

          const isNewlyAdded = highlightVisitId !== null && Number(highlightVisitId) === Number(visit.id);
          return `
            <div class="visit-item${isNewlyAdded ? " visit-item--new" : ""}" id="visit-row-${visit.id}">
              <div class="visit-item__date">${isoToJalaliDisplay(visit.visit_date)}
                <a href="#" onclick="event.preventDefault(); deleteVisit(${visit.id})" style="font-size:12px; color:var(--danger); margin-right:10px;">حذف مراجعه</a>
                <a href="#" onclick="event.preventDefault(); openEditVisitModal(${visit.id})" style="font-size:12px; color:var(--primary); margin-right:10px;">ویرایش مراجعه</a>
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
              <div class="car-card__sub">${car.year ? "سال " + car.year : ""} ${car.plate ? "· پلاک " + car.plate : ""} ${car.current_mileage ? "· کارکرد فعلی: " + formatMileageDisplay(car.current_mileage) + " کیلومتر" : ""}</div>
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

// ---------- ویرایش قطعه تعویض‌شده ----------
function findPart(partId) {
  const cars = (currentCustomer && currentCustomer.cars) || [];
  for (const car of cars) {
    for (const visit of car.visits || []) {
      for (const part of visit.parts || []) {
        if (Number(part.id) === Number(partId)) return part;
      }
    }
  }
  return null;
}

function findVisitAndCar(visitId) {
  const cars = (currentCustomer && currentCustomer.cars) || [];
  for (const car of cars) {
    for (const visit of car.visits || []) {
      if (Number(visit.id) === Number(visitId)) return { visit, car };
    }
  }
  return null;
}

function openEditPartModal(partId) {
  const part = findPart(partId);
  if (!part) return;
  const form = document.getElementById("edit-part-form");
  form.part_id.value = part.id;
  form.part_name.value = part.part_name || "";
  form.replaced_at_mileage.value = part.replaced_at_mileage ?? "";
  form.next_due_mileage.value = part.next_due_mileage ?? "";
  form.notes.value = part.notes || "";
  document.getElementById("edit-part-modal").classList.add("open");
}

document.getElementById("close-edit-part-modal").addEventListener("click", () => {
  document.getElementById("edit-part-modal").classList.remove("open");
});

function clearPartHighlight() {
  if (highlightPartId === null) return;
  const el = document.getElementById(`part-chip-${highlightPartId}`);
  if (el) el.classList.remove("part-chip--updated");
  highlightPartId = null;
}

function armPartHighlightClear() {
  const controller = new AbortController();
  const handler = () => {
    controller.abort();
    clearPartHighlight();
  };
  const opts = { signal: controller.signal, passive: true };
  document.addEventListener("click", handler, opts);
  document.addEventListener("mousemove", handler, opts);
  document.addEventListener("keydown", handler, opts);
  document.addEventListener("touchstart", handler, opts);
  document.addEventListener("wheel", handler, opts);
}

document.getElementById("edit-part-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const partId = form.part_id.value;
  const name = form.part_name.value.trim();
  if (!name) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.classList.add("btn-loading");
  submitBtn.textContent = "در حال ذخیره...";

  let result;
  try {
    result = await PanelAPI.updatePart(partId, {
      part_name: name,
      replaced_at_mileage: parseMileageInput(form.replaced_at_mileage.value.trim()),
      next_due_mileage: parseMileageInput(form.next_due_mileage.value.trim()),
      notes: form.notes.value.trim(),
    });
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove("btn-loading");
    submitBtn.textContent = originalBtnText;
  }

  if (result.error) {
    alert(result.error);
    return;
  }

  document.getElementById("edit-part-modal").classList.remove("open");

  highlightPartId = Number(partId);
  await loadCustomer();

  const chip = document.getElementById(`part-chip-${highlightPartId}`);
  if (chip) chip.scrollIntoView({ behavior: "smooth", block: "center" });
  armPartHighlightClear();
});

// حذف نشانه‌گذاری سبز رنگ ردیف تازه ثبت‌شده
function clearVisitHighlight() {
  if (highlightVisitId === null) return;
  const el = document.getElementById(`visit-row-${highlightVisitId}`);
  if (el) el.classList.remove("visit-item--new");
  highlightVisitId = null;
}

// از اولین حرکت/کلیک/فشردن کلید بعدی کاربر، نشانه‌گذاری سبز رنگ حذف شود
function armVisitHighlightClear() {
  const controller = new AbortController();
  const handler = () => {
    controller.abort();
    clearVisitHighlight();
  };
  const opts = { signal: controller.signal, passive: true };
  document.addEventListener("click", handler, opts);
  document.addEventListener("mousemove", handler, opts);
  document.addEventListener("keydown", handler, opts);
  document.addEventListener("touchstart", handler, opts);
  document.addEventListener("wheel", handler, opts);
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
      <label>کارکرد هنگام تعویض (کیلومتر)</label>
      <input type="text" inputmode="numeric" class="part-mileage-input" placeholder="مثلاً ۸۵۰۰۰ (اختیاری)" />
    </div>
    <div class="field">
      <label>کارکرد موعد تعویض بعدی (کیلومتر)</label>
      <input type="text" inputmode="numeric" class="part-next-mileage-input" placeholder="مثلاً ۱۰۵۰۰۰ (اختیاری)" />
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
    const mileageRaw = row.querySelector(".part-mileage-input").value.trim();
    const nextMileageRaw = row.querySelector(".part-next-mileage-input").value.trim();
    if (!name) return;
    parts.push({
      part_name: name,
      replaced_at_mileage: parseMileageInput(mileageRaw),
      next_due_mileage: parseMileageInput(nextMileageRaw),
    });
  });

  const currentMileageRaw = form.current_mileage.value.trim();

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.classList.add("btn-loading");
  submitBtn.textContent = "در حال ثبت...";

  let result;
  try {
    result = await PanelAPI.addVisit({
      car_id: form.car_id.value,
      visit_date: visitIso,
      current_mileage: parseMileageInput(currentMileageRaw),
      complaints: form.complaints.value.trim(),
      resolved: form.resolved.value.trim(),
      notes: form.notes.value.trim(),
      parts,
    });
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove("btn-loading");
    submitBtn.textContent = originalBtnText;
  }

  if (result.error) {
    alert(result.error);
    return;
  }

  document.getElementById("visit-modal").classList.remove("open");

  highlightVisitId = result.id;
  await loadCustomer();

  const row = document.getElementById(`visit-row-${highlightVisitId}`);
  if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  armVisitHighlightClear();
});

loadCustomer();
