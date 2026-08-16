// ثبت سبک بازدید صفحه برای آمار سایت و پنل مدیریت — بدون کوکی، فقط شمارش
(function () {
  try {
    var path = window.location.pathname.split("/").pop() || "index.html";
    var isPanel = path.indexOf("panel-") === 0;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: path,
        referrer: document.referrer || null,
        is_panel: isPanel,
      }),
      keepalive: true,
    }).catch(function () {});
  } catch (_) {
    // اگر ثبت آمار به هر دلیلی شکست خورد، نباید مانع کار کاربر روی سایت بشود
  }
})();
