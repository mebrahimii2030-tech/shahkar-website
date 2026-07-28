// نمایش زمان آخرین ورود و هشدار ورود مشکوک، بالای داشبورد پنل مدیریت
(function () {
  const mount = document.getElementById("security-banner");
  if (!mount) return;

  function formatPersianDateTime(sqliteUtcValue) {
    if (!sqliteUtcValue) return null;
    // مقدار ذخیره‌شده در دیتابیس با datetime('now') به‌صورت UTC است
    const iso = sqliteUtcValue.includes("T") ? sqliteUtcValue : sqliteUtcValue.replace(" ", "T") + "Z";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return sqliteUtcValue;
    try {
      return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
    } catch (_) {
      return date.toLocaleString("fa-IR");
    }
  }

  fetch("/api/admin/security")
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (data) {
      if (!data) return;
      const lastLoginText = formatPersianDateTime(data.lastLogin);
      const suspicious = !!data.suspicious;

      if (!suspicious && !lastLoginText) return; // اولین ورود؛ چیزی برای نمایش نیست

      const box = document.createElement("div");
      box.className = "security-banner" + (suspicious ? " security-banner--suspicious" : "");

      if (suspicious) {
        box.innerHTML =
          '<i class="fa-solid fa-triangle-exclamation"></i>' +
          "<div><strong>هشدار: ورود از آدرس اینترنتی جدید</strong>" +
          "این ورود از یک آدرس اینترنتی متفاوت نسبت به ورود قبلی انجام شده" +
          (lastLoginText ? " (ورود قبلی: " + lastLoginText + ")" : "") +
          ". اگر این ورود توسط شما نبوده، هرچه سریع‌تر رمز عبور پنل را از Settings پروژه Worker در Cloudflare تغییر بده.</div>";
      } else {
        box.innerHTML =
          '<i class="fa-solid fa-circle-check"></i>' +
          "<div><strong>خوش آمدید</strong>آخرین ورود شما: " + lastLoginText + "</div>";
      }

      mount.appendChild(box);
    })
    .catch(function () {
      // اگر این درخواست ناموفق بود، داشبورد بدون بنر امنیتی نمایش داده می‌شود
    });
})();
