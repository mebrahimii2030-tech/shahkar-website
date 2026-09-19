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

function kindLabel(kind) {
  return kind === "routing" ? "مسیریابی" : "سایت";
}

// ---------- خلاصه وضعیت ----------

function renderSummary() {
  const locations = new Set(allCampaigns.map((c) => c.title)).size;
  const totalScans = allCampaigns.reduce((sum, c) => sum + (c.scan_count || 0), 0);
  const totalUnique = allCampaigns.reduce((sum, c) => sum + (c.unique_count || 0), 0);

  const box = (label, count, cls) => `
    <div class="due-pill due-pill--${cls}" style="font-size:15px; padding:10px 18px;">
      ${label}: ${count}
    </div>`;

  document.getElementById("qr-summary-boxes").innerHTML =
    box("تعداد محدوده", locations, "none") +
    box("تعداد QR", allCampaigns.length, "none") +
    box("مجموع اسکن", totalScans, "ok") +
    box("مجموع کاربر یکتا", totalUnique, "soon");
}

// ---------- جدول محدوده‌ها ----------

function renderTable() {
  const tbody = document.getElementById("qr-tbody");
  if (!allCampaigns.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">هنوز محدوده‌ای ثبت نشده است</td></tr>`;
    return;
  }

  tbody.innerHTML = allCampaigns
    .map((c) => {
      const link = qrFullUrl(c.code);
      const img = qrImageUrl(c.code, 90);
      const downloadImg = qrImageUrl(c.code, 600);
      const badgeClass = c.kind === "routing" ? "qr-kind-badge--routing" : "qr-kind-badge--site";
      const targetDisplay = c.kind === "routing" ? "صفحه انتخاب مسیریاب" : c.target_path;
      return `
        <tr>
          <td><span class="customer-name">${escapeHtml(c.title)}</span></td>
          <td><span class="qr-kind-badge ${badgeClass}">${kindLabel(c.kind)}</span></td>
          <td style="font-family:monospace; direction:ltr;">${escapeHtml(c.serial)}</td>
          <td>
            <span style="font-family:monospace; direction:ltr; display:inline-block;">${escapeHtml(link)}</span>
            <button class="copy-link-btn" onclick="copyQrLink('${escapeHtml(c.code)}')">کپی</button>
          </td>
          <td>${escapeHtml(targetDisplay)}</td>
          <td>${c.scan_count || 0} (${c.unique_count || 0})</td>
          <td>
            <img src="${img}" width="70" height="70" alt="QR ${escapeHtml(c.title)}" style="border-radius:6px;" />
            <br />
            <a href="${downloadImg}" download="qr-${escapeHtml(c.serial)}.png" class="copy-link-btn">دانلود PNG</a>
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

// ---------- جستجوی سریال ----------

function normalizeSerial(s) {
  return String(s || "").trim().toUpperCase();
}

function runSerialSearch() {
  const box = document.getElementById("serial-search-result");
  const q = normalizeSerial(document.getElementById("serial-search-input").value);
  if (!q) {
    box.style.display = "none";
    return;
  }
  const found = allCampaigns.find((c) => normalizeSerial(c.serial) === q);
  box.style.display = "block";
  if (!found) {
    box.innerHTML = `<strong>یافت نشد.</strong> سریال «${escapeHtml(q)}» به هیچ محدوده‌ای اختصاص داده نشده.`;
    return;
  }
  box.innerHTML = `
    <strong>سریال ${escapeHtml(found.serial)}</strong> متعلق به محدوده «${escapeHtml(found.title)}» — نوع: ${kindLabel(found.kind)}<br />
    آدرس QR: <span style="direction:ltr; display:inline-block; font-family:monospace;">${escapeHtml(qrFullUrl(found.code))}</span><br />
    تعداد اسکن تا الان: ${found.scan_count || 0} (یکتا: ${found.unique_count || 0})
  `;
}

document.getElementById("serial-search-btn").addEventListener("click", runSerialSearch);
document.getElementById("serial-search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    runSerialSearch();
  }
});

// ---------- فرم افزودن/ویرایش ----------

const form = document.getElementById("qr-form");
const formTitle = document.getElementById("qr-form-title");
const submitBtn = document.getElementById("qr-submit-btn");
const cancelBtn = document.getElementById("qr-cancel-btn");
const newBtn = document.getElementById("qr-new-btn");
const siteField = document.getElementById("site-target-field");
const routingNote = document.getElementById("routing-auto-note");
const ROUTING_TARGET = "/route.html"; // صفحه ثابت انتخاب مسیریاب (گوگل‌مپ/نشان/بلد) — همیشه همین است، نیازی به لینک دستی نیست

function resetForm() {
  form.reset();
  form.edit_code.value = "";
  form.edit_kind.value = "";
  siteField.hidden = false;
  routingNote.hidden = false;
  formTitle.textContent = "افزودن محدوده جدید";
  submitBtn.textContent = "ثبت محدوده";
  cancelBtn.hidden = true;
  newBtn.hidden = true;
}

function openEditCampaign(code) {
  const c = allCampaigns.find((x) => x.code === code);
  if (!c) return;

  form.edit_code.value = c.code;
  form.edit_kind.value = c.kind;
  form.title.value = c.title;

  if (c.kind === "routing") {
    // QR مسیریابی همیشه به یک صفحه ثابت می‌رود؛ فقط نام محدوده قابل ویرایش است
    siteField.hidden = true;
    routingNote.hidden = true;
  } else {
    siteField.hidden = false;
    routingNote.hidden = true;
    form.target_path.value = c.target_path;
  }

  formTitle.textContent = `ویرایش QR ${kindLabel(c.kind)} — ${c.title} (سریال ${c.serial})`;
  submitBtn.textContent = "ذخیره تغییرات";
  cancelBtn.hidden = false;
  newBtn.hidden = false;

  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

cancelBtn.addEventListener("click", resetForm);
newBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const editCode = form.edit_code.value;
  const editKind = form.edit_kind.value;
  const title = form.title.value.trim();
  if (!title) {
    alert("نام محدوده الزامی است");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.classList.add("btn-loading");

  let result;
  if (editCode) {
    // ویرایش یک ردیف موجود؛ برای نوع مسیریابی مقصد همیشه ثابت است
    const targetValue = editKind === "routing" ? ROUTING_TARGET : form.target_path.value.trim() || "/";
    result = await PanelAPI.updateQrCampaign(editCode, { title, target_path: targetValue });
  } else {
    // ساخت محدوده جدید: همیشه هم QR سایت و هم QR مسیریابی با هم ساخته می‌شوند
    result = await PanelAPI.createQrCampaign({ title, kind: "site", target_path: form.target_path.value.trim() || "/" });
    if (!result || result.error) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
      alert((result && result.error) || "خطا در ساخت QR سایت");
      return;
    }
    const routingResult = await PanelAPI.createQrCampaign({ title, kind: "routing", target_path: ROUTING_TARGET });
    if (!routingResult || routingResult.error) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
      alert("QR سایت ساخته شد، ولی ساخت QR مسیریابی با خطا مواجه شد: " + ((routingResult && routingResult.error) || ""));
      resetForm();
      await loadCampaigns();
      return;
    }
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
  const label = c ? `${c.title} (${kindLabel(c.kind)}، سریال ${c.serial})` : "این QR";
  const sure = confirm(`آیا مطمئن هستی می‌خواهی «${label}» را حذف کنی؟ QR چاپ‌شده مربوط به آن دیگر کار نخواهد کرد.`);
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
