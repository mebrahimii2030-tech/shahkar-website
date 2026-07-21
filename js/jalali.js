/**
 * تبدیل تاریخ شمسی (جلالی) به میلادی و برعکس
 * پیاده‌سازی الگوریتم استاندارد تقویم جلالی (بدون وابستگی خارجی)
 * ذخیره‌سازی همیشه به میلادی (YYYY-MM-DD) است؛ نمایش و ورودی همیشه شمسی است.
 */

function div(a, b) {
  return ~~(a / b);
}

function jalCal(jy) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const gy = jy + 621;
  let leapJ = -14,
    jp = breaks[0];
  let jump = 0;
  for (let i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(jump % 33, 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div((n % 33) + 3, 4);
  if (jump % 33 === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = ((n + 1) % 33) - 1;
  if (leap === -1) leap = 32;
  return { leap: leap % 4 === 0, march };
}

function jalaliToGregorian(jy, jm, jd) {
  const cal = jalCal(jy);
  const gy = jy + 621;
  const march = cal.march;
  const jDayCount = (jm <= 6 ? (jm - 1) * 31 : 186 + (jm - 7) * 30) + (jd - 1);

  const gDate = new Date(Date.UTC(gy, 2, march)); // فروردین ۱ برابر است با «march»ام روز اسفند/فروردینِ میلادی
  gDate.setUTCDate(gDate.getUTCDate() + jDayCount);
  return [gDate.getUTCFullYear(), gDate.getUTCMonth() + 1, gDate.getUTCDate()];
}

function gregorianToJalali(gy, gm, gd) {
  const g2d = Date.UTC(gy, gm - 1, gd);
  // حدس اولیه سال جلالی و اصلاح با جستجوی کوچک اطراف آن
  let jy = gy - 621;
  for (let tries = 0; tries < 3; tries += 1) {
    const cal = jalCal(jy);
    const marchFirst = Date.UTC(jy + 621, 2, cal.march);
    const diffDays = Math.round((g2d - marchFirst) / 86400000);
    if (diffDays < 0) {
      jy -= 1;
      continue;
    }
    const yearLength = cal.leap ? 366 : 365;
    if (diffDays >= yearLength) {
      jy += 1;
      continue;
    }
    let jm, jd;
    if (diffDays < 186) {
      jm = Math.floor(diffDays / 31) + 1;
      jd = (diffDays % 31) + 1;
    } else {
      const rem = diffDays - 186;
      jm = Math.floor(rem / 30) + 7;
      jd = (rem % 30) + 1;
    }
    return [jy, jm, jd];
  }
  return [jy, 1, 1];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// ISO میلادی "YYYY-MM-DD" -> رشته نمایشی شمسی "YYYY/MM/DD"
function isoToJalaliDisplay(iso) {
  if (!iso) return "";
  const [gy, gm, gd] = iso.split("-").map(Number);
  if (!gy) return "";
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
  return `${jy}/${pad2(jm)}/${pad2(jd)}`;
}

// ورودی شمسی "YYYY/MM/DD" یا "YYYY-MM-DD" -> ISO میلادی "YYYY-MM-DD"
function jalaliInputToIso(input) {
  if (!input) return null;
  const parts = input.trim().split(/[\/\-]/).map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [jy, jm, jd] = parts;
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  return `${gy}-${pad2(gm)}-${pad2(gd)}`;
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

// تبدیل ارقام فارسی/عربی به انگلیسی، برای فیلدهایی مثل کارکرد (کیلومتر)
// که کاربر ممکن است با صفحه‌کلید فارسی وارد کند
function normalizeDigits(input) {
  if (input === null || input === undefined) return "";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return String(input).replace(/[۰-۹٠-٩]/g, (ch) => {
    const pIndex = persian.indexOf(ch);
    if (pIndex > -1) return String(pIndex);
    const aIndex = arabic.indexOf(ch);
    return aIndex > -1 ? String(aIndex) : ch;
  });
}

// ورودی آزاد کارکرد (مثلاً "۸۵٬۰۰۰" یا "85000 کیلومتر") -> عدد صحیح یا null
function parseMileageInput(input) {
  if (!input) return null;
  const digitsOnly = normalizeDigits(input).replace(/[^\d]/g, "");
  if (!digitsOnly) return null;
  return parseInt(digitsOnly, 10);
}

// عدد کارکرد -> رشته نمایشی با جداکننده هزارگان، مثلاً 85,000
function formatMileageDisplay(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("en-US");
}
