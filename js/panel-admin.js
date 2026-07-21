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

const STATUS_LABEL = {
  overdue: "موعد گذشته",
  soon: "نزدیک است",
  ok: "بدون نگرانی",
  none: "بدون قطعه ثبت‌شده",
};

function renderSummary() {
  const counts = { overdue: 0, soon: 0, ok: 0 };
  allCustomers.forEach((c) => {
    const s = dueStatusClient(c.nearest_due_date);
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
      const status = dueStatusClient(c.nearest_due_date);
      const dueDisplay = c.nearest_due_date ? isoToJalaliDisplay(c.nearest_due_date) : "—";
      const link = `${location.origin}/customer.html?code=${c.code}`;
      return `
        <tr onclick="location.href='panel-customer.html?code=${c.code}'">
          <td class="customer-name">${c.first_name} ${c.last_name}</td>
          <td>${c.phone || "—"}</td>
          <td>${c.car_count || 0}</td>
          <td><span class="due-pill due-pill--${status}">${dueDisplay !== "—" ? dueDisplay : STATUS_LABEL[status]}</span></td>
          <td>
            <button class="copy-link-btn" onclick="event.stopPropagation(); copyCustomerLink('${link}', this)">
              کپی لینک
            </button>
          </td>
        </tr>`;
    })
    .join("");
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
