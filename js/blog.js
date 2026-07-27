// وبلاگ شاهکار: مطالب از دیتابیس (از طریق /api/articles) خوانده می‌شوند،
// سپس فیلتر دسته‌بندی، جستجو و باز/بسته‌کردن متن کامل روی همان‌ها اجرا می‌شود.

(function () {
  const PERSIAN_MONTHS = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
  ];
  const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

  function toPersianDigits(value) {
    return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[+d]);
  }

  // ISO میلادی "YYYY-MM-DD" -> رشته نمایشی شمسی با نام ماه، مثلاً "۲۰ مرداد ۱۴۰۴"
  function isoToJalaliLong(iso) {
    if (!iso || typeof gregorianToJalali !== "function") return "";
    const [gy, gm, gd] = iso.split("-").map(Number);
    if (!gy || !gm || !gd) return "";
    const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
    return `${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // متن کامل مقاله را با خط خالی به پاراگراف‌های جدا تبدیل می‌کند (بدون نیاز به HTML از سمت پنل مدیریت)
  function contentToParagraphs(content) {
    return String(content || "")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function categoryToSlug(category) {
    return "cat-" + String(category || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function renderMeta(article) {
    const parts = [];
    if (article.published_date) {
      parts.push(`<span><i class="fa-regular fa-calendar"></i> ${isoToJalaliLong(article.published_date)}</span>`);
    }
    if (article.read_minutes) {
      parts.push(`<span><i class="fa-regular fa-clock"></i> ${toPersianDigits(article.read_minutes)} دقیقه مطالعه</span>`);
    }
    if (article.author) {
      parts.push(`<span><i class="fa-regular fa-user"></i> ${escapeHtml(article.author)}</span>`);
    }
    return parts.join("");
  }

  function renderFeaturedCard(article) {
    return `
      <div class="blog-featured-icon">
        <i class="${escapeHtml(article.icon || "fa-solid fa-star")}"></i>
      </div>
      <div class="blog-featured-body">
        <span class="blog-badge blog-badge--featured"><i class="fa-solid fa-star"></i> مطلب ویژه</span>
        <h2>${escapeHtml(article.title)}</h2>
        <p>${escapeHtml(article.excerpt || "")}</p>
        <div class="blog-meta">${renderMeta(article)}</div>
        <button class="blog-toggle" data-target="post-${article.id}-full" type="button">
          <span class="blog-toggle-label">ادامه مطلب</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="blog-full" id="post-${article.id}-full" hidden>
          ${contentToParagraphs(article.content)}
        </div>
      </div>`;
  }

  function renderCard(article) {
    return `
      <article class="blog-card" id="post-${article.id}" data-category="${categoryToSlug(article.category)}">
        <div class="blog-card-icon"><i class="${escapeHtml(article.icon || "fa-solid fa-newspaper")}"></i></div>
        <div class="blog-card-body">
          <span class="blog-badge">${escapeHtml(article.category)}</span>
          <h3>${escapeHtml(article.title)}</h3>
          <p class="blog-excerpt">${escapeHtml(article.excerpt || "")}</p>
          <div class="blog-meta">${renderMeta(article)}</div>
          <button class="blog-toggle" data-target="post-${article.id}-full" type="button">
            <span class="blog-toggle-label">ادامه مطلب</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="blog-full" id="post-${article.id}-full" hidden>
            ${contentToParagraphs(article.content)}
          </div>
        </div>
      </article>`;
  }

  function attachToggleHandlers(root) {
    root.querySelectorAll(".blog-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        const isOpen = !target.hidden;
        target.hidden = isOpen;
        btn.classList.toggle("is-open", !isOpen);
        const label = btn.querySelector(".blog-toggle-label");
        if (label) label.textContent = isOpen ? "ادامه مطلب" : "بستن مطلب";
      });
    });
  }

  async function loadArticles() {
    const loadingEl = document.getElementById("blog-loading");
    const listEl = document.getElementById("blog-list");
    const featuredSlot = document.getElementById("blog-featured-slot");
    const emptyState = document.getElementById("blog-empty");
    const searchInput = document.getElementById("blog-search-input");
    const sidebarCategories = document.getElementById("sidebar-categories");
    const sidebarLatest = document.getElementById("sidebar-latest");

    let articles = [];
    try {
      const res = await fetch("/api/articles");
      const data = await res.json();
      articles = Array.isArray(data.articles) ? data.articles : [];
    } catch (_) {
      articles = [];
    }

    if (loadingEl) loadingEl.hidden = true;

    if (!articles.length) {
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.querySelector("i")?.classList.add("fa-magnifying-glass");
      }
      return;
    }

    // مطلب ویژه: جدیدترین مقاله‌ای که is_featured دارد؛ از لیست عادی حذف می‌شود
    const featured = articles.find((a) => a.is_featured);
    const rest = featured ? articles.filter((a) => a.id !== featured.id) : articles.slice();

    if (featured) {
      featuredSlot.hidden = false;
      featuredSlot.id = `post-${featured.id}`;
      featuredSlot.innerHTML = renderFeaturedCard(featured);
      attachToggleHandlers(featuredSlot);
    }

    listEl.innerHTML = rest.map(renderCard).join("");
    attachToggleHandlers(listEl);

    // ---- سایدبار: دسته‌بندی‌ها (خودکار از مقادیر واقعی مقالات ساخته می‌شود) ----
    const categoryCounts = new Map();
    articles.forEach((a) => {
      const key = a.category || "بدون دسته";
      categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
    });

    document.getElementById("cat-count-all").textContent = toPersianDigits(articles.length);
    let categoryButtonsHtml = `<li><button class="cat-btn is-active" data-category="all" type="button">همه مطالب <span>${toPersianDigits(articles.length)}</span></button></li>`;
    categoryCounts.forEach((count, category) => {
      categoryButtonsHtml += `<li><button class="cat-btn" data-category="${categoryToSlug(category)}" type="button">${escapeHtml(category)} <span>${toPersianDigits(count)}</span></button></li>`;
    });
    sidebarCategories.innerHTML = categoryButtonsHtml;

    // ---- سایدبار: جدیدترین مطالب (۴ مورد اخیر) ----
    const latest = articles.slice(0, 4);
    sidebarLatest.innerHTML = latest
      .map(
        (a, i) => `
        <li>
          <span class="pop-num">${toPersianDigits(i + 1)}</span>
          <a href="#post-${a.id}">${escapeHtml(a.title)}</a>
        </li>`
      )
      .join("");

    // ---- فیلتر دسته‌بندی + جستجو ----
    let activeCategory = "all";
    const cards = () => Array.from(listEl.querySelectorAll(".blog-card"));

    function applyFilters() {
      const query = (searchInput?.value || "").trim().toLowerCase();
      let visibleCount = 0;

      cards().forEach((card) => {
        const category = card.dataset.category || "";
        const text = card.innerText.toLowerCase();
        const matchesCategory = activeCategory === "all" || category === activeCategory;
        const matchesQuery = query === "" || text.includes(query);
        const show = matchesCategory && matchesQuery;
        card.style.display = show ? "" : "none";
        if (show) visibleCount += 1;
      });

      if (featured) {
        const featuredText = featuredSlot.innerText.toLowerCase();
        const featuredMatchesQuery = query === "" || featuredText.includes(query);
        const showFeatured = activeCategory === "all" && featuredMatchesQuery;
        featuredSlot.style.display = showFeatured ? "" : "none";
        if (showFeatured) visibleCount += 1;
      }

      if (emptyState) emptyState.hidden = visibleCount !== 0;
    }

    sidebarCategories.querySelectorAll(".cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        sidebarCategories.querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        activeCategory = btn.dataset.category;
        applyFilters();
      });
    });

    if (searchInput) searchInput.addEventListener("input", applyFilters);

    // ---- پرش از «جدیدترین مطالب» به پست موردنظر ----
    sidebarLatest.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (e) => {
        const targetId = link.getAttribute("href")?.replace("#", "");
        const targetCard = document.getElementById(targetId);
        if (!targetCard) return;

        e.preventDefault();

        const resetBtn = sidebarCategories.querySelector('.cat-btn[data-category="all"]');
        if (resetBtn && targetCard.style.display === "none") resetBtn.click();

        targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
        targetCard.classList.add("is-highlighted");
        setTimeout(() => targetCard.classList.remove("is-highlighted"), 1800);

        const toggleBtn = targetCard.querySelector(".blog-toggle");
        const fullText = targetCard.querySelector(".blog-full");
        if (toggleBtn && fullText && fullText.hidden) toggleBtn.click();
      });
    });
  }

  loadArticles();
})();
