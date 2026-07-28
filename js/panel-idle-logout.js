// خروج خودکار از پنل مدیریت پس از عدم فعالیت طولانی — برای جلوگیری از باز
// ماندن نشست ورود روی سیستم مشترک یا فراموش‌شده. این اسکریپت در تمام
// صفحات پنل مدیریت (panel-admin, panel-customers, panel-customer, panel-blog)
// لود می‌شود و با استفاده از localStorage بین چند تب هم‌زمان‌سازی می‌شود.
(function () {
  if (!document.body || !document.body.classList.contains("panel-body")) return;
  // صفحه‌ی ورود خودش نیازی به این تایمر ندارد (چون هنوز نشستی وجود ندارد)
  if (/panel-login\.html$/i.test(window.location.pathname)) return;

  const IDLE_LIMIT_MS = 20 * 60 * 1000; // ۲۰ دقیقه بدون هیچ فعالیتی
  const WARNING_BEFORE_MS = 60 * 1000; // ۶۰ ثانیه قبل از خروج، هشدار نمایش داده می‌شود
  const ACTIVITY_KEY = "shahkar_admin_last_activity";
  const CHECK_INTERVAL_MS = 5000;

  let warningShown = false;
  let overlay = null;
  let countdownTimer = null;

  function now() {
    return Date.now();
  }

  function readLastActivity() {
    const stored = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : now();
  }

  function markActivity() {
    try {
      localStorage.setItem(ACTIVITY_KEY, String(now()));
    } catch (_) {
      // اگر localStorage در دسترس نبود (حالت خصوصی مرورگر و ...)، فقط از هم‌زمانی بین تب‌ها صرف‌نظر می‌شود
    }
    if (warningShown) hideWarning();
  }

  async function doLogout(reason) {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch (_) {
      // حتی اگر درخواست ناموفق بود، کاربر را به صفحه‌ی ورود می‌فرستیم
    }
    try {
      localStorage.removeItem(ACTIVITY_KEY);
    } catch (_) {}
    window.location.href = "panel-login.html?reason=" + encodeURIComponent(reason);
  }

  function buildOverlay() {
    const el = document.createElement("div");
    el.className = "idle-warning-overlay";
    el.innerHTML =
      '<div class="idle-warning-box">' +
      '<i class="fa-solid fa-clock"></i>' +
      "<h3>عدم فعالیت</h3>" +
      '<p>به‌دلیل عدم فعالیت، تا <span id="idle-countdown">60</span> ثانیه دیگر به‌صورت خودکار از پنل خارج می‌شوید.</p>' +
      '<button type="button" class="btn btn-primary" id="idle-stay-btn">ادامه کار در پنل</button>' +
      "</div>";
    document.body.appendChild(el);
    const stayBtn = document.getElementById("idle-stay-btn");
    if (stayBtn) stayBtn.addEventListener("click", markActivity);
    return el;
  }

  function showWarning() {
    if (warningShown) return;
    warningShown = true;
    overlay = buildOverlay();
    let remaining = Math.round(WARNING_BEFORE_MS / 1000);
    const countdownEl = document.getElementById("idle-countdown");
    if (countdownEl) countdownEl.textContent = String(remaining);
    countdownTimer = setInterval(function () {
      remaining -= 1;
      if (countdownEl) countdownEl.textContent = String(Math.max(remaining, 0));
      if (remaining <= 0 && countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }, 1000);
  }

  function hideWarning() {
    warningShown = false;
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function checkIdle() {
    const elapsed = now() - readLastActivity();
    if (elapsed >= IDLE_LIMIT_MS) {
      doLogout("idle");
      return;
    }
    if (elapsed >= IDLE_LIMIT_MS - WARNING_BEFORE_MS) {
      showWarning();
    }
  }

  ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart", "click"].forEach(function (evt) {
    window.addEventListener(evt, markActivity, { passive: true });
  });

  // اگر در یک تب دیگر فعالیتی ثبت شد، هشدار همین تب هم بسته شود
  window.addEventListener("storage", function (e) {
    if (e.key === ACTIVITY_KEY && warningShown) hideWarning();
  });

  markActivity();
  setInterval(checkIdle, CHECK_INTERVAL_MS);
})();
