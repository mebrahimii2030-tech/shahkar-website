// دکمه‌ی خروج مشترک پنل‌های مدیریت — نشست را باطل می‌کند و به صفحه‌ی ورود برمی‌گرداند
(function () {
  const btn = document.getElementById("panel-logout-btn");
  if (!btn) return;

  btn.addEventListener("click", async function () {
    btn.disabled = true;
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch (_) {
      // حتی اگر درخواست ناموفق بود، کاربر را به صفحه‌ی ورود می‌فرستیم
    }
    window.location.href = "panel-login.html";
  });
})();
