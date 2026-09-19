let allCampaigns = [];

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function qrFullUrl(code) {
  return `${window.location.origin}/qr/${encodeURIComponent(code)}`;
}

function qrImageUrl(code, size) {
  const data = encodeURIComponent(qrFullUrl(code));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
}

// ---------- خلاصه وضعیت ----------

function renderSummary() {
  const totalScans = allCampaigns.reduce((sum, c) => sum + (c.scan_count || 0), 0);
  const totalUnique = allCampaigns.reduce((sum, c) => sum + (c.unique_count || 0), 0);

  const box = (label, count, cls) => `
    <div class="due-pill due-pill--${cls}" style="font-size:15px; padding:10px 18px;">
      ${label}: ${count}
    </div>`;

  document.getElementById("qr-summary-boxes").innerHTML =
    box("تعداد محدوده", allCampaigns.length, "none") +
    box("مجموع اسکن", totalScans, "ok") +
    box("مجموع کاربر یکتا", totalUnique, "soon");
}

// ---------- جدول محدوده‌ها ----------

function renderTable() {
  const tbody = document.getElementById("qr-tbody");
  if (!allCampaigns.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">هنوز محدوده‌ای ثبت نشده است</td></tr>`;
    return;
  }

  tbody.innerHTML = allCampaigns
    .map((c) => {
      const link = qrFullUrl(c.code);
      const img = qrImageUrl(c.code, 90);
      const downloadImg = qrImageUrl(c.code, 600);
      return `
        <tr>
          <td><span class="customer-name">${escapeHtml(c.title)}</span></td>
          <td>
            <span style="font-family:monospace; direction:ltr; display:inline-block;">${escapeHtml(link)}</span>
            <button class="copy-link-btn" onclick="copyQrLink('${escapeHtml(c.code)}')">کپی</button>
          </td>
          <td>${escapeHtml(c.target_path)}</td>
          <td>${c.scan_count || 0} (${c.unique_count || 0})</td>
          <td>
            <img src="${img}" width="70" height="70" alt="QR ${escapeHtml(c.title)}" style="border-radius:6px;" />
            <br />
            <a href="${downloadImg}" download="qr-${escapeHtml(c.code)}.png" class="copy-link-btn">دانلود PNG</a>
          </td>
          <td>
            <button class="copy-link-btn" onclick="openEditCampaign('${escapeHtml(c.code)}')">ویرایش</button>
            <button class="copy-link-btn copy-link-btn--danger" onclick="handleDeleteCampaign('${escapeHtml(c.code)}')">حذف</button>
          </td>
        </tr>`;
    })
    .join("");
}

function copyQrLink(code) {
  navigator.clipboard.writeText(qrFullUrl(code)).then(
    () => alert("لینک کپی شد."),
    () => alert("کپی خودکار ممکن نشد؛ لینک را دستی انتخاب و کپی کن.")
  );
}

// ---------- فرم افزودن/ویرایش ----------

const form = document.getElementById("qr-form");
const formTitle = document.getElementById("qr-form-title");
const submitBtn = document.getElementById("qr-submit-btn");
const cancelBtn = document.getElementById("qr-cancel-btn");
const newBtn = document.getElementById("qr-new-btn");

function resetForm() {
  form.reset();
  form.original_code.value = "";
  form.code.disabled = false;
  formTitle.textContent = "افزودن محدوده جدید";
  submitBtn.textContent = "ثبت محدوده";
  cancelBtn.hidden = true;
  newBtn.hidden = true;
}

function openEditCampaign(code) {
  const c = allCampaigns.find((x) => x.code === code);
  if (!c) return;
  form.original_code.value = c.code;
  form.title.value = c.title;
  form.code.value = c.code;
  form.code.disabled = true; // کد بعد از ساخت قابل تغییر نیست چون روی تراکت‌های چاپ‌شده هم هست
  form.target_path.value = c.target_path;

  formTitle.textContent = `ویرایش محدوده: ${c.title}`;
  submitBtn.textContent = "ذخیره تغییرات";
  cancelBtn.hidden = false;
  newBtn.hidden = false;

  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

cancelBtn.addEventListener("click", resetForm);
newBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const originalCode = form.original_code.value;
  const title = form.title.value.trim();
  if (!title) {
    alert("نام محدوده الزامی است");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.classList.add("btn-loading");

  let result;
  if (originalCode) {
    result = await PanelAPI.updateQrCampaign(originalCode, {
      title,
      target_path: form.target_path.value.trim() || "/",
    });
  } else {
    result = await PanelAPI.createQrCampaign({
      title,
      code: form.code.value.trim(),
      target_path: form.target_path.value.trim() || "/",
    });
  }

  submitBtn.disabled = false;
  submitBtn.classList.remove("btn-loading");

  if (result && result.error) {
    alert(result.error);
    return;
  }

  resetForm();
  await loadCampaigns();
});

async function handleDeleteCampaign(code) {
  const c = allCampaigns.find((x) => x.code === code);
  const title = c ? c.title : "این محدوده";
  const sure = confirm(`آیا مطمئن هستی می‌خواهی «${title}» را حذف کنی؟ QR چاپ‌شده مربوط به آن دیگر کار نخواهد کرد.`);
  if (!sure) return;

  const result = await PanelAPI.deleteQrCampaign(code);
  if (result && result.error) {
    alert(result.error);
    return;
  }
  await loadCampaigns();
}

async function loadCampaigns() {
  const data = await PanelAPI.listQrCampaigns();
  allCampaigns = data.campaigns || [];
  renderSummary();
  renderTable();
}

resetForm();
loadCampaigns();
