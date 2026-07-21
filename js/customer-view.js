const CUSTOMER_CODE = new URLSearchParams(location.search).get("code");

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
    document.getElementById("customer-title").textContent = "لینک نامعتبر است";
    return;
  }
  const data = await PanelAPI.getCustomer(CUSTOMER_CODE);
  if (data.error) {
    document.getElementById("customer-title").textContent = "این لینک معتبر نیست یا منقضی شده است";
    return;
  }
  render(data.customer);
}

function render(customer) {
  document.getElementById("customer-title").textContent = `${customer.first_name} عزیز`;

  // پیدا کردن نزدیک‌ترین موعد در بین همه قطعات همه خودروها، برای نمایش در بالای صفحه
  let nearest = null;
  (customer.cars || []).forEach((car) => {
    (car.visits || []).forEach((visit) => {
      (visit.parts || []).forEach((p) => {
        if (!p.next_due_date) return;
        if (!nearest || p.next_due_date < nearest.next_due_date) {
          nearest = { ...p, carLabel: `${car.brand} ${car.model}` };
        }
      });
    });
  });

  const heroEl = document.getElementById("hero-callout");
  if (nearest) {
    const status = dueStatusClient(nearest.next_due_date);
    const statusText =
      status === "overdue" ? "موعد این قطعه گذشته — لطفاً هرچه زودتر مراجعه کنید"
      : status === "soon" ? "موعد این قطعه نزدیک است"
      : "نزدیک‌ترین موعد تعویض شما";
    const mileageSub = nearest.next_due_mileage
      ? `<div class="hero-callout__sub">کارکرد موعد: ${formatMileageDisplay(nearest.next_due_mileage)} کیلومتر</div>`
      : "";
    heroEl.innerHTML = `
      <div class="hero-callout">
        <div class="hero-callout__label">${statusText}</div>
        <div class="hero-callout__main">${nearest.part_name} · ${nearest.carLabel}</div>
        <div class="hero-callout__sub">تاریخ موعد: ${isoToJalaliDisplay(nearest.next_due_date)}</div>
        ${mileageSub}
      </div>`;
  } else {
    heroEl.innerHTML = "";
  }

  renderCars(customer.cars || []);
}

function renderCars(cars) {
  const container = document.getElementById("cars-container");
  if (!cars.length) {
    container.innerHTML = `<div class="panel-card empty-state">هنوز سابقه‌ای برای خودرویی ثبت نشده است</div>`;
    return;
  }

  container.innerHTML = cars
    .map((car) => {
      const visitsHtml = (car.visits || [])
        .map((visit) => {
          const partsHtml = (visit.parts || [])
            .map((p) => {
              const status = dueStatusClient(p.next_due_date);
              const dueText = p.next_due_date ? `موعد بعدی: ${isoToJalaliDisplay(p.next_due_date)}` : "بدون موعد مشخص";
              const mileageBits = [];
              if (p.replaced_at_mileage) mileageBits.push(`کارکرد تعویض: ${formatMileageDisplay(p.replaced_at_mileage)} کیلومتر`);
              if (p.next_due_mileage) mileageBits.push(`موعد بعدی: ${formatMileageDisplay(p.next_due_mileage)} کیلومتر`);
              const mileageHtml = mileageBits.length
                ? `<div class="part-entry__mileage">${mileageBits.join(" · ")}</div>`
                : "";
              return `
                <div class="part-entry">
                  <span class="part-chip due-pill--${status}">${p.part_name} · ${dueText}</span>
                  ${mileageHtml}
                </div>`;
            })
            .join("");

          return `
            <div class="visit-item">
              <div class="visit-item__date">${isoToJalaliDisplay(visit.visit_date)}</div>
              ${visit.complaints ? `<div class="visit-item__row"><b>ایراد اعلامی:</b> ${visit.complaints}</div>` : ""}
              ${visit.resolved ? `<div class="visit-item__row"><b>رفع‌شده:</b> ${visit.resolved}</div>` : ""}
              <div class="parts-list">${partsHtml || '<span style="color:var(--gray-400); font-size:13px;">قطعه‌ای ثبت نشده</span>'}</div>
            </div>`;
        })
        .join("");

      return `
        <div class="panel-card car-card">
          <div class="car-card__title">${car.brand} ${car.model}</div>
          <div class="car-card__sub">${car.year ? "سال " + car.year : ""} ${car.plate ? "· پلاک " + car.plate : ""}</div>
          <div class="visit-timeline">
            ${visitsHtml || '<div class="empty-state" style="padding:16px;">هنوز مراجعه‌ای ثبت نشده</div>'}
          </div>
        </div>`;
    })
    .join("");
}

loadCustomer();
