let allCampaigns = [];
let locations = []; // هر آیتم: { seq, title, site, routing }

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

// ---------- گروه‌بندی روی هم بر اساس محدوده ----------

function groupByLocation(campaigns) {
  const map = new Map();
  campaigns.forEach((c) => {
    if (!map.has(c.serial_number)) {
      map.set(c.serial_number, { seq: c.serial_number, title: c.title, site: null, routing: null });
    }
    const loc = map.get(c.serial_number);
    if (c.kind === "routing") loc.routing = c;
    else loc.site = c;
  });
  return Array.from(map.values()).sort((a, b) => a.seq - b.seq);
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
    box("تعداد محدوده", locations.length, "none") +
    box("تعداد QR", allCampaigns.length, "none") +
    box("مجموع اسکن", totalScans, "ok") +
    box("مجموع کاربر یکتا", totalUnique, "soon");
}

// ---------- بلوک هر محدوده ----------

function qrMiniCard(campaign, kind) {
  if (!campaign) {
    return `<div class="qr-mini"><div class="qr-mini__body">QR ${kindLabel(kind)} برای این محدوده وجود ندارد.</div></div>`;
  }
  const img = qrImageUrl(campaign.code, 90);
  const downloadImg = qrImageUrl(campaign.code, 600);
  return `
    <div class="qr-mini">
      <img src="${img}" width="72" height="72" alt="QR ${kindLabel(kind)}" />
      <div class="qr-mini__body">
        <strong>${kindLabel(kind)}</strong> — سریال <span style="font-family:monospace;direction:ltr;">${escapeHtml(campaign.serial)}</span>
        <span class="qr-mini__link">${escapeHtml(qrFullUrl(campaign.code))}</span>
        اسکن: ${campaign.scan_count || 0} (یکتا: ${campaign.unique_count || 0})
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="copy-link-btn" onclick="copyQrLink('${escapeHtml(campaign.code)}')">کپی لینک</button>
          <a href="${downloadImg}" download="qr-${escapeHtml(campaign.serial)}.png" class="copy-link-btn">دانلود PNG</a>
        </div>
      </div>
    </div>`;
}

function renderLocations() {
  const container = document.getElementById("qr-locations");
  if (!locations.length) {
    container.innerHTML = `<div class="panel-card"><p class="empty-state">هنوز محدوده‌ای ثبت نشده است</p></div>`;
    return;
  }

  container.innerHTML = locations
    .map(
      (loc) => `
      <div class="panel-card">
        <div class="qr-location-head">
          <div>
            <strong style="font-size:16px;">${escapeHtml(loc.title)}</strong>
            <span class="qr-location-serial">SHK-${String(loc.seq).padStart(3, "0")}</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="copy-link-btn" onclick="openEditLocation(${loc.seq})">ویرایش</button>
            <button class="copy-link-btn copy-link-btn--danger" onclick="handleDeleteLocation(${loc.seq})">حذف محدوده</button>
          </div>
        </div>
        <div class="qr-pair">
          ${qrMiniCard(loc.site, "site")}
          ${qrMiniCard(loc.routing, "routing")}
        </div>
      </div>`
    )
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

function resetForm() {
  form.reset();
  form.edit_seq.value = "";
  formTitle.textContent = "افزودن محدوده جدید";
  submitBtn.textContent = "ثبت محدوده";
  cancelBtn.hidden = true;
  newBtn.hidden = true;
}

function openEditLocation(seq) {
  const loc = locations.find((x) => x.seq === seq);
  if (!loc) return;

  form.edit_seq.value = loc.seq;
  form.title.value = loc.title;
  form.target_path.value = loc.site ? loc.site.target_path : "/";

  formTitle.textContent = `ویرایش محدوده «${loc.title}» (SHK-${String(loc.seq).padStart(3, "0")})`;
  submitBtn.textContent = "ذخیره تغییرات";
  cancelBtn.hidden = false;
  newBtn.hidden = false;

  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

cancelBtn.addEventListener("click", resetForm);
newBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const editSeq = form.edit_seq.value;
  const title = form.title.value.trim();
  if (!title) {
    alert("نام محدوده الزامی است");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.classList.add("btn-loading");

  const targetPath = form.target_path.value.trim() || "/";
  const result = editSeq
    ? await PanelAPI.updateQrLocation(editSeq, { title, target_path: targetPath })
    : await PanelAPI.createQrLocation({ title, target_path: targetPath });

  submitBtn.disabled = false;
  submitBtn.classList.remove("btn-loading");

  if (result && result.error) {
    alert(result.error);
    return;
  }

  resetForm();
  await loadCampaigns();
});

async function handleDeleteLocation(seq) {
  const loc = locations.find((x) => x.seq === seq);
  const label = loc ? loc.title : "این محدوده";
  const sure = confirm(`آیا مطمئن هستی می‌خواهی «${label}» و هر دو QR آن را حذف کنی؟ QR های چاپ‌شده مربوط به آن دیگر کار نخواهند کرد.`);
  if (!sure) return;

  const result = await PanelAPI.deleteQrLocation(seq);
  if (result && result.error) {
    alert(result.error);
    return;
  }
  await loadCampaigns();
}

async function loadCampaigns() {
  const data = await PanelAPI.listQrCampaigns();
  allCampaigns = data.campaigns || [];
  locations = groupByLocation(allCampaigns);
  renderSummary();
  renderLocations();
}

resetForm();
loadCampaigns();
