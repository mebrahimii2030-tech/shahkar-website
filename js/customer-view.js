const CUSTOMER_CODE = new URLSearchParams(location.search).get("code");
// توجه: dueStatusByMileage و dueStatusCssClass از js/jalali.js می‌آیند

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

  // پیدا کردن نزدیک‌ترین موعد (کمترین کیلومتر باقیمانده) در بین همه قطعات همه خودروها
  let nearest = null;
  let nearestRemaining = null;
  (customer.cars || []).forEach((car) => {
    (car.visits || []).forEach((visit) => {
      (visit.parts || []).forEach((p) => {
        if (!p.next_due_mileage || !car.current_mileage) return;
        const remaining = p.next_due_mileage - car.current_mileage;
        if (nearestRemaining === null || remaining < nearestRemaining) {
          nearestRemaining = remaining;
          nearest = { ...p, carLabel: `${car.brand} ${car.model}`, currentMileage: car.current_mileage };
        }
      });
    });
  });

  const heroEl = document.getElementById("hero-callout");
  if (nearest) {
    const status = dueStatusByMileage(nearest.currentMileage, nearest.next_due_mileage);
    const statusText =
      status === "overdue" ? "موعد این قطعه گذشته — لطفاً هرچه زودتر مراجعه کنید"
      : status === "soon" ? "موعد این قطعه نزدیک است"
      : "نزدیک‌ترین موعد تعویض شما";
    heroEl.innerHTML = `
      <div class="hero-callout">
        <div class="hero-callout__label">${statusText}</div>
        <div class="hero-callout__main">${nearest.part_name} · ${nearest.carLabel}</div>
        <div class="hero-callout__sub">کارکرد موعد: ${formatMileageDisplay(nearest.next_due_mileage)} کیلومتر (کارکرد فعلی: ${formatMileageDisplay(nearest.currentMileage)} کیلومتر)</div>
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
              const status = dueStatusByMileage(car.current_mileage, p.next_due_mileage);
              const dueText = p.next_due_mileage
                ? `موعد بعدی: ${formatMileageDisplay(p.next_due_mileage)} کیلومتر`
                : "بدون موعد مشخص";
              const mileageBits = [];
              if (p.replaced_at_mileage) mileageBits.push(`کارکرد تعویض: ${formatMileageDisplay(p.replaced_at_mileage)} کیلومتر`);
              const mileageHtml = mileageBits.length
                ? `<div class="part-entry__mileage">${mileageBits.join(" · ")}</div>`
                : "";
              return `
                <div class="part-entry">
                  <span class="part-chip due-pill--${dueStatusCssClass(status)}">${p.part_name} · ${dueText}</span>
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
          <div class="car-card__sub">${car.year ? "سال " + car.year : ""} ${car.plate ? "· پلاک " + car.plate : ""} ${car.current_mileage ? "· کارکرد فعلی: " + formatMileageDisplay(car.current_mileage) + " کیلومتر" : ""}</div>
          <div class="visit-timeline">
            ${visitsHtml || '<div class="empty-state" style="padding:16px;">هنوز مراجعه‌ای ثبت نشده</div>'}
          </div>
        </div>`;
    })
    .join("");
}

loadCustomer();
