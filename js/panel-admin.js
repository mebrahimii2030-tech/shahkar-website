let allCustomers = [];

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
