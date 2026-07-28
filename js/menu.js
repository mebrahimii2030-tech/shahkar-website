function initMenu() {
  const sideMenu = document.getElementById("sideMenu");
  const menuToggle = document.getElementById("menuToggle");
  const menuArrow = document.getElementById("menuArrow");
  const overlay = document.getElementById("sideMenuOverlay");

  if (!sideMenu || !menuToggle) return;

  function isMobile() {
    return window.innerWidth <= 640;
  }

  function openMenu() {
    sideMenu.classList.add("expanded");
    if (isMobile()) {
      overlay?.classList.add("show");
      document.body.style.overflow = "hidden";
    }
  }

  function closeMenu() {
    sideMenu.classList.remove("expanded");
    sideMenu.classList.add("force-collapsed");
    overlay?.classList.remove("show");
    document.body.style.overflow = "";
  }

  // once the mouse actually leaves, let hover-to-expand work normally again
  sideMenu.addEventListener("mouseleave", () => {
    sideMenu.classList.remove("force-collapsed");
  });

  // On hover-capable devices the menu can already be visually open
  // purely via CSS :hover, without the "expanded" class ever being
  // added. Checking classList alone would get out of sync with what
  // the user actually sees, so we check the real rendered width instead.
  function isVisuallyOpen() {
    const collapsed = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--side-collapsed")
    );
    return sideMenu.getBoundingClientRect().width > collapsed + 5;
  }

  function toggleMenu() {
    if (isVisuallyOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  menuToggle.addEventListener("click", toggleMenu);
  menuArrow?.addEventListener("click", toggleMenu);

  overlay?.addEventListener("click", closeMenu);

  // زیرمنوی «خدمات»: باز/بسته شدن با کلیک روی فلش، بدون این‌که کل منو بسته شود
  document.querySelectorAll(".side-submenu-toggle").forEach((toggleBtn) => {
    toggleBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const group = toggleBtn.closest(".side-item-group");
      if (!group) return;
      const isOpen = group.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  });

  // لینک‌های واقعی (که به یک صفحه می‌روند): روی موبایل بعد از کلیک، منو بسته شود
  document.querySelectorAll(".side-item:not(.side-item-parent), .side-item-link, .side-subitem").forEach((link) => {
    link.addEventListener("click", () => {
      if (isMobile()) closeMenu();
    });
  });

  // Highlight the active page link (هم آیتم‌های اصلی، هم زیرمنوی خدمات)
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".side-item:not(.side-item-parent)").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) {
      link.classList.add("active");
    }
  });

  document.querySelectorAll(".side-item-link").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) {
      link.closest(".side-item-parent")?.classList.add("active");
    }
  });

  document.querySelectorAll(".side-subitem").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) {
      link.classList.add("active");
      const group = link.closest(".side-item-group");
      if (group) {
        group.classList.add("open");
        const parentItem = group.querySelector(".side-item-parent");
        const toggleBtn = group.querySelector(".side-submenu-toggle");
        parentItem?.classList.add("active");
        toggleBtn?.setAttribute("aria-expanded", "true");
      }
    }
  });
}
