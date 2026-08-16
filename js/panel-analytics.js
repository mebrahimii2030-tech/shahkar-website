// نمایش آمار بازدید سایت و پنل مدیریت بالای داشبورد
(function () {
  const statsMount = document.getElementById("analytics-stats");
  const topPagesMount = document.getElementById("top-pages");
  if (!statsMount) return;

  function formatNumber(n) {
    return new Intl.NumberFormat("fa-IR").format(n || 0);
  }

  function pageLabel(path) {
    const map = {
      "index.html": "خانه",
      "about.html": "درباره ما",
      "services.html": "خدمات",
      "engine.html": "تعمیر موتور",
      "gearbox.html": "گیربکس",
      "electrical.html": "برق خودرو",
      "suspension.html": "جلوبندی",
      "maintenance.html": "سرویس دوره‌ای",
      "diagnostics.html": "دیاگ تخصصی",
      "gallery.html": "نمونه کارها",
      "pricing.html": "تعرفه‌ها",
      "blog.html": "وبلاگ",
      "faq.html": "سوالات متداول",
      "contact.html": "تماس با ما",
      "customer.html": "استعلام مشتری",
    };
    return map[path] || path;
  }

  fetch("/api/admin/analytics")
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (data) {
      if (!data) return;

      const cards = [
        { icon: "fa-eye", value: data.totalViews, label: "کل بازدیدهای سایت" },
        { icon: "fa-calendar-day", value: data.todayViews, label: "بازدید امروز" },
        { icon: "fa-chart-line", value: data.last7DaysViews, label: "بازدید ۷ روز اخیر" },
        { icon: "fa-user-shield", value: data.panelViews, label: "مراجعه به پنل مدیریت", panel: true },
      ];

      statsMount.innerHTML = cards
        .map(function (c) {
          return (
            '<div class="stat-card' +
            (c.panel ? " stat-card--panel" : "") +
            '"><div class="stat-card__icon"><i class="fa-solid ' +
            c.icon +
            '"></i></div><div><div class="stat-card__value">' +
            formatNumber(c.value) +
            '</div><div class="stat-card__label">' +
            c.label +
            "</div></div></div>"
          );
        })
        .join("");

      if (topPagesMount && Array.isArray(data.topPages) && data.topPages.length) {
        const max = Math.max.apply(
          null,
          data.topPages.map(function (p) {
            return p.views;
          })
        );
        topPagesMount.innerHTML =
          "<h3>پربازدیدترین صفحات</h3>" +
          '<div class="top-pages-list">' +
          data.topPages
            .map(function (p) {
              const pct = max ? Math.round((p.views / max) * 100) : 0;
              return (
                '<div class="top-pages-row"><span class="top-pages-row__name">' +
                pageLabel(p.path) +
                '</span><span class="top-pages-row__bar"><span class="top-pages-row__bar-fill" style="width:' +
                pct +
                '%"></span></span><span class="top-pages-row__count">' +
                formatNumber(p.views) +
                "</span></div>"
              );
            })
            .join("") +
          "</div>";
      }
    })
    .catch(function () {
      // اگر آمار در دسترس نبود، داشبورد بدون این بخش نمایش داده می‌شود
    });
})();
