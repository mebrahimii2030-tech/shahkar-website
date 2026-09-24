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

function kindLabel(kind) {
  return kind === "routing" ? "مسیریابی" : "سایت";
}

// رنگ اختصاصی هر نوع QR: سایت → همرنگ برند اصلی، مسیریابی → کهربایی (رنگ ثانویه برند)
function kindColor(kind) {
  return kind === "routing" ? "#d97706" : "#0f172a";
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

// ---------- ساخت تصویر QR با لوگو و رنگ اختصاصی ----------

const qrInstances = {};

function buildQrCode(campaign) {
  const color = kindColor(campaign.kind);
  return new QRCodeStyling({
    width: 600,
    height: 600,
    type: "canvas",
    data: qrFullUrl(campaign.code),
    margin: 4,
    qrOptions: { errorCorrectionLevel: "M" },
    dotsOptions: { color, type: "rounded" },
    cornersSquareOptions: { color, type: "extra-rounded" },
    cornersDotOptions: { color },
    backgroundOptions: { color: "#ffffff" },
  });
}

// بعد از این‌که HTML بلوک‌های محدوده در صفحه قرار گرفت، QR واقعی هر کدام ساخته و داخل جای خودش رندر می‌شود
function renderQrImages() {
  locations.forEach((loc) => {
    [loc.site, loc.routing].forEach((c) => {
      if (!c) return;
      const holder = document.getElementById(`qr-canvas-${c.code}`);
      if (!holder) return;
      holder.innerHTML = "";
      const qr = buildQrCode(c);
      qr.append(holder);
      qrInstances[c.code] = qr;
    });
  });
}

function downloadQr(code, serial) {
  const qr = qrInstances[code];
  if (!qr) return;
  qr.download({ name: `qr-${serial}`, extension: "png" });
}

// ---------- بلوک هر محدوده ----------

function qrMiniCard(campaign, kind) {
  if (!campaign) {
    return `<div class="qr-mini"><div class="qr-mini__body">QR ${kindLabel(kind)} برای این محدوده وجود ندارد.</div></div>`;
  }
  return `
    <div class="qr-mini">
      <div class="qr-mini__canvas" id="qr-canvas-${escapeHtml(campaign.code)}"></div>
      <div class="qr-mini__body">
        <strong>${kindLabel(kind)}</strong> — سریال <span style="font-family:monospace;direction:ltr;">${escapeHtml(campaign.serial)}</span>
        <span class="qr-mini__link">${escapeHtml(qrFullUrl(campaign.code))}</span>
        اسکن: ${campaign.scan_count || 0} (یکتا: ${campaign.unique_count || 0})
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="copy-link-btn" onclick="copyQrLink('${escapeHtml(campaign.code)}')">کپی لینک</button>
          <button class="copy-link-btn" onclick="downloadQr('${escapeHtml(campaign.code)}', '${escapeHtml(campaign.serial)}')">دانلود PNG</button>
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

  renderQrImages();
}

function copyQrLink(code) {
  navigator.clipboard.writeText(qrFullUrl(code)).then(
    () => alert("لینک کپی شد."),
    () => alert("کپی خودکار ممکن نشد؛ لینک را دستی انتخاب و کپی کن.")
  );
}

// ---------- نسخه پشتیبان ----------
// یک فایل CSV از همه کدها/سریال‌ها/عنوان‌ها می‌سازد تا مستقل از دیتابیس، همیشه یک مدرک
// از چیزی که واقعاً روی تراکت چاپ شده داشته باشیم
function downloadBackup() {
  if (!allCampaigns.length) {
    alert("هنوز محدوده‌ای برای پشتیبان‌گیری وجود ندارد.");
    return;
  }
  const rows = [["سریال", "محدوده", "نوع", "کد QR", "آدرس QR", "مقصد", "تاریخ ساخت"]];
  allCampaigns.forEach((c) => {
    rows.push([c.serial, c.title, kindLabel(c.kind), c.code, qrFullUrl(c.code), c.target_path, c.created_at]);
  });
  const csv = "\uFEFF" + rows.map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qr-backup-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById("qr-backup-btn").addEventListener("click", downloadBackup);

// ---------- بازیابی از فایل پشتیبان ----------
// فایلی که خود دکمه «دانلود نسخه پشتیبان» ساخته را می‌خواند و محدوده‌های
// گم‌شده را با همان کد QR قبلی (که روی تراکت چاپ شده) دوباره می‌سازد.

function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function serialToKindAndSeq(serial) {
  const m = String(serial || "").trim().match(/^SHK-(\d+)-([SM])$/i);
  if (!m) return null;
  return { serial_number: parseInt(m[1], 10), kind: m[2].toUpperCase() === "M" ? "routing" : "site" };
}

async function handleRestoreFile(file) {
  const text = await file.text();
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r\n|\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    alert("فایل خالی است یا چیزی برای بازیابی ندارد.");
    return;
  }

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const iSerial = idx("سریال");
  const iTitle = idx("محدوده");
  const iCode = idx("کد QR");
  const iTarget = idx("مقصد");
  const iCreated = idx("تاریخ ساخت");

  if (iSerial === -1 || iTitle === -1 || iCode === -1) {
    alert("ساختار فایل شناخته نشد. فقط فایلی را وارد کن که خودِ همین پنل با «دانلود نسخه پشتیبان» ساخته باشد.");
    return;
  }

  const campaigns = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const info = serialToKindAndSeq(cells[iSerial]);
    if (!info || !cells[iCode] || !cells[iTitle]) continue;
    campaigns.push({
      code: cells[iCode],
      title: cells[iTitle],
      target_path: iTarget !== -1 ? cells[iTarget] : "/",
      kind: info.kind,
      serial_number: info.serial_number,
      created_at: iCreated !== -1 ? cells[iCreated] : null,
    });
  }

  if (!campaigns.length) {
    alert("هیچ ردیف قابل بازیابی در فایل پیدا نشد.");
    return;
  }

  const result = await PanelAPI.restoreQrCampaigns(campaigns);
  if (result && result.error) {
    alert(result.error);
    return;
  }
  alert(`${result.restored} مورد بازیابی شد. ${result.skipped} مورد رد شد (از قبل موجود بود یا ناقص بود).`);
  await loadCampaigns();
}

document.getElementById("qr-restore-input").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    await handleRestoreFile(file);
  } catch (err) {
    alert("خواندن فایل با خطا مواجه شد. مطمئن شو فایل همان CSV دانلودشده از همین پنل است.");
  }
});

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
const routingAutoNote = document.getElementById("routing-auto-note");
const routingTargetField = document.getElementById("routing-target-field");

function resetForm() {
  form.reset();
  form.edit_seq.value = "";
  formTitle.textContent = "افزودن محدوده جدید";
  submitBtn.textContent = "ثبت محدوده";
  cancelBtn.hidden = true;
  newBtn.hidden = true;
  routingAutoNote.hidden = false;
  routingTargetField.hidden = true;
}

function openEditLocation(seq) {
  const loc = locations.find((x) => x.seq === seq);
  if (!loc) return;

  form.edit_seq.value = loc.seq;
  form.title.value = loc.title;
  form.target_path.value = loc.site ? loc.site.target_path : "/";
  form.routing_target.value = loc.routing ? loc.routing.target_path : "/route.html";

  routingAutoNote.hidden = true;
  routingTargetField.hidden = false;

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
    ? await PanelAPI.updateQrLocation(editSeq, {
        title,
        target_path: targetPath,
        routing_target: form.routing_target.value.trim() || "/route.html",
      })
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
  const serialTag = `SHK-${String(seq).padStart(3, "0")}`;

  // چون این QR ها احتمالاً چاپ شده‌اند، حذف تصادفی با یک کلیک اشتباه ممکن نیست؛
  // باید سریال محدوده را عیناً تایپ کنی تا حذف واقعاً انجام شود
  const typed = prompt(
    `برای حذف «${label}» (${serialTag}) و هر دو QR آن، سریال را دقیقاً تایپ کن:\n${serialTag}\n\nاگر مطمئن نیستی، این پنجره را ببند.`
  );
  if (typed === null) return;
  if (typed.trim().toUpperCase() !== serialTag) {
    alert("سریال درست تایپ نشد؛ محدوده حذف نشد.");
    return;
  }

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
