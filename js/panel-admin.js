let allCustomers = [];

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAdminDate(raw) {
  if (!raw) return "—";
  const datePart = String(raw).split(" ")[0];
  try {
    const display = isoToJalaliDisplay(datePart);
    if (display) return display;
  } catch (_) {
    // در صورت خطا از مقدار خام استفاده می‌شود
  }
  return datePart;
}

// وضعیت موعد از روی کیلومتر باقیمانده‌ای که سرور محاسبه کرده (nearest_remaining_km)
function dueStatusFromRemaining(remainingKm) {
  if (remainingKm === null || remainingKm === undefined) return "none";
  if (remainingKm <= 0) return "overdue";
  if (remainingKm <= MILEAGE_DUE_SOON_KM) return "soon";
  return "ok";
}

const STATUS_LABEL = MILEAGE_STATUS_LABEL;

function renderSummary() {
  const counts = { overdue: 0, soon: 0, ok: 0 };
  allCustomers.forEach((c) => {
    const s = dueStatusFromRemaining(c.nearest_remaining_km);
    if (counts[s] !== undefined) counts[s] += 1;
  });

  const box = (label, count, cls) => `
    <div class="due-pill due-pill--${cls}" style="font-size:15px; padding:10px 18px;">
      ${label}: ${count}
    </div>`;

  document.getElementById("summary-boxes").innerHTML =
    box("موعد گذشته", counts.overdue, "overdue") +
    box("نزدیک به موعد (۱۴ روز)", counts.soon, "soon") +
    box("در وضعیت عادی", counts.ok, "ok");
}

function renderTable(list) {
  const tbody = document.getElementById("customers-tbody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">هنوز مشتری‌ای ثبت نشده است</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((c) => {
      const status = dueStatusFromRemaining(c.nearest_remaining_km);
      const remaining = c.nearest_remaining_km;
      let dueDisplay;
      if (remaining === null || remaining === undefined) {
        dueDisplay = STATUS_LABEL.none;
      } else if (remaining <= 0) {
        dueDisplay = `${formatMileageDisplay(Math.abs(remaining))} کیلومتر گذشته`;
      } else {
        dueDisplay = `${formatMileageDisplay(remaining)} کیلومتر مانده`;
      }
      const link = `${location.origin}/customer.html?code=${c.code}`;
      return `
        <tr onclick="location.href='panel-customer.html?code=${c.code}'">
          <td class="customer-name">${escapeHtml(c.first_name)} ${escapeHtml(c.last_name)}</td>
          <td>${escapeHtml(c.phone) || "—"}</td>
          <td>${c.car_count || 0}</td>
          <td><span class="due-pill due-pill--${dueStatusCssClass(status)}">${dueDisplay}</span></td>
          <td>
            <button class="copy-link-btn" onclick="event.stopPropagation(); copyCustomerLink('${link}', this)">
              کپی لینک
            </button>
            <button class="copy-link-btn" onclick="event.stopPropagation(); openEditCustomerModal('${c.code}')">
              ویرایش
            </button>
            <button class="copy-link-btn copy-link-btn--danger" onclick="event.stopPropagation(); handleDeleteCustomer('${c.code}')">
              حذف
            </button>
          </td>
        </tr>`;
    })
    .join("");
}

// ---------- ویرایش مشتری از داخل جدول اصلی پنل ----------
function openEditCustomerModal(code) {
  const c = allCustomers.find((x) => x.code === code);
  if (!c) return;
  const form = document.getElementById("edit-customer-form");
  form.code.value = c.code;
  form.first_name.value = c.first_name;
  form.last_name.value = c.last_name;
  form.phone.value = c.phone || "";
  document.getElementById("edit-customer-modal").classList.add("open");
}

document.getElementById("close-edit-customer-modal").addEventListener("click", () => {
  document.getElementById("edit-customer-modal").classList.remove("open");
});

document.getElementById("edit-customer-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const code = form.code.value;
  const data = {
    first_name: form.first_name.value.trim(),
    last_name: form.last_name.value.trim(),
    phone: form.phone.value.trim(),
  };
  if (!data.first_name || !data.last_name) return;

  const updated = await PanelAPI.updateCustomer(code, data);
  if (updated.error) {
    alert(updated.error);
    return;
  }
  document.getElementById("edit-customer-modal").classList.remove("open");
  await loadCustomers();
});

async function handleDeleteCustomer(code) {
  const c = allCustomers.find((x) => x.code === code);
  const name = c ? `${c.first_name} ${c.last_name}` : "این مشتری";
  const sure = confirm(
    `آیا مطمئن هستید می‌خواهید «${name}» را حذف کنید؟\nتمام اطلاعات این مشتری شامل خودروها، مراجعات و قطعات ثبت‌شده به‌طور کامل و غیرقابل‌بازگشت پاک می‌شود.`
  );
  if (!sure) return;

  const result = await PanelAPI.deleteCustomer(code);
  if (result && result.error) {
    alert(result.error);
    return;
  }
  await loadCustomers();
}

function copyCustomerLink(link, btn) {
  navigator.clipboard.writeText(link).then(() => {
    const original = btn.textContent;
    btn.textContent = "کپی شد ✓";
    setTimeout(() => (btn.textContent = original), 1500);
  });
}

async function loadCustomers() {
  const data = await PanelAPI.listCustomers();
  allCustomers = data.customers || [];
  renderSummary();
  renderTable(allCustomers);
}

// ---------- دیدگاه‌های مشتریان ----------

function renderReviewsTable(list) {
  const tbody = document.getElementById("reviews-tbody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">هنوز دیدگاهی ثبت نشده است</td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map(
      (r) => `
        <tr>
          <td class="customer-name">${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.phone)}</td>
          <td>${escapeHtml(r.comment)}</td>
          <td>${formatAdminDate(r.created_at)}</td>
          <td>
            <button class="copy-link-btn" onclick="handleDeleteReview(${r.id})">حذف</button>
          </td>
        </tr>`
    )
    .join("");
}

async function loadReviews() {
  const data = await PanelAPI.listReviewsAdmin();
  renderReviewsTable(data.reviews || []);
}

async function handleDeleteReview(id) {
  if (!confirm("این دیدگاه حذف شود؟")) return;
  await PanelAPI.deleteReview(id);
  await loadReviews();
}

// ---------- پیام‌های فرم تماس با ما ----------

function renderMessagesTable(list) {
  const tbody = document.getElementById("messages-tbody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">هنوز پیامی دریافت نشده است</td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map((m) => {
      const subject = m.subject ? `${escapeHtml(m.subject)}: ` : "";
      return `
        <tr>
          <td class="customer-name">${escapeHtml(m.name)}</td>
          <td>${escapeHtml(m.phone || m.email || "—")}</td>
          <td>${subject}${escapeHtml(m.body)}</td>
          <td>${formatAdminDate(m.created_at)}</td>
          <td><span class="due-pill due-pill--${m.is_read ? "ok" : "soon"}">${m.is_read ? "خوانده‌شده" : "خوانده‌نشده"}</span></td>
          <td>
            ${m.is_read ? "" : `<button class="copy-link-btn" onclick="handleMarkMessageRead(${m.id})">خواندم</button>`}
            <button class="copy-link-btn" onclick="handleDeleteMessage(${m.id})">حذف</button>
          </td>
        </tr>`;
    })
    .join("");
}

async function loadMessages() {
  const data = await PanelAPI.listMessages();
  renderMessagesTable(data.messages || []);
}

async function handleMarkMessageRead(id) {
  await PanelAPI.markMessageRead(id);
  await loadMessages();
}

async function handleDeleteMessage(id) {
  if (!confirm("این پیام حذف شود؟")) return;
  await PanelAPI.deleteMessage(id);
  await loadMessages();
}

document.getElementById("search-box").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = allCustomers.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
  );
  renderTable(filtered);
});

document.getElementById("new-customer-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    first_name: form.first_name.value.trim(),
    last_name: form.last_name.value.trim(),
    phone: form.phone.value.trim(),
  };
  if (!data.first_name || !data.last_name) return;

  const created = await PanelAPI.createCustomer(data);
  if (created.error) {
    alert(created.error);
    return;
  }
  form.reset();
  await loadCustomers();
  location.href = `panel-customer.html?code=${created.code}`;
});

loadCustomers();
loadReviews();
loadMessages();
