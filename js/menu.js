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

  document.querySelectorAll(".side-item").forEach((link) => {
    link.addEventListener("click", () => {
      if (isMobile()) closeMenu();
    });
  });

  // Highlight the active page link
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".side-item").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) {
      link.classList.add("active");
    }
  });
}
