async function loadComponent(id, file) {
  const element = document.getElementById(id);

  if (!element) return;

  try {
    const response = await fetch(file);
    element.innerHTML = await response.text();

    if (id === "header") {
      initMenu();
    }
  } catch (err) {
    console.error("خطا در بارگذاری کامپوننت:", file, err);
  }
}

// تا وقتی هدر و فوتر (که با fetch جدا لود می‌شوند) واقعاً آماده نشده‌اند،
// صفحه نمایش داده نمی‌شود؛ این‌طوری به‌جای چشمک سفید/نارنجی، صفحه یک‌باره
// و کامل با یک محو ملایم (fade-in) ظاهر می‌شود
function revealApp() {
  document.documentElement.classList.add("app-ready");
}

Promise.all([loadComponent("header", "components/header.html"), loadComponent("footer", "components/footer.html")]).finally(revealApp);

// شبکه ایمنی: اگر اینترنت کند بود یا خطایی پیش آمد، صفحه برای همیشه سفید/مخفی نماند
setTimeout(revealApp, 1500);
