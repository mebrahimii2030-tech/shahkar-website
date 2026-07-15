/* ==========================
   Header Scroll Effect
========================== */

const header = document.querySelector(".header");

if (header) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 60) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });
}

/* ==========================
   Animated Counter
========================== */

const counters = document.querySelectorAll(".counter");

if (counters.length > 0) {
  const runCounter = (counter) => {
    const target = +counter.dataset.target;
    let current = 0;
    const increment = Math.ceil(target / 80);

    const updateCounter = () => {
      current += increment;
      if (current < target) {
        counter.innerText = current;
        setTimeout(updateCounter, 20);
      } else {
        counter.innerText = target;
      }
    };

    updateCounter();
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 },
  );

  counters.forEach((counter) => observer.observe(counter));
}

/* ==========================
   Map Modal
========================== */

const openBtn = document.getElementById("openMaps");
const closeBtn = document.getElementById("closeMaps");
const modal = document.getElementById("mapModal");

if (openBtn && closeBtn && modal) {
  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    modal.classList.add("active");
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      modal.classList.remove("active");
    }
  });
}
/* ==========================
   Hide Header On Scroll
========================== */

let lastScroll = 0;

window.addEventListener("scroll", () => {
  const currentScroll = window.pageYOffset;

  if (currentScroll <= 50) {
    header.classList.remove("hide");
    lastScroll = currentScroll;
    return;
  }

  if (currentScroll > lastScroll) {
    header.classList.add("hide");
  } else {
    header.classList.remove("hide");
  }

  lastScroll = currentScroll;
});

document.addEventListener("mousemove", (e) => {
  if (e.clientY <= 20) {
    header.classList.remove("hide");
  }
});
console.log("JS Loaded");

window.addEventListener("scroll", () => {
  console.log(window.scrollY);
});
// ==============================
//   SHAHKAR FOOTER VIP SCRIPT
// ==============================

function updateShopStatus() {
  const status = document.getElementById("shopStatus");
  if (!status) return;

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour + minute / 60;

  const openHour = 8;
  const closeHour = 20;

  let isOpen = time >= openHour && time < closeHour;

  if (isOpen) {
    status.classList.add("open");
    status.classList.remove("closed");
    status.innerHTML = "🟢 اکنون تعمیرگاه باز است";
  } else {
    status.classList.add("closed");
    status.classList.remove("open");
    status.innerHTML = "🔴 در حال حاضر تعمیرگاه تعطیل است";
  }
}

// اجرا
updateShopStatus();

// هر دقیقه آپدیت شود
setInterval(updateShopStatus, 60000);

// ==============================
//   MAP MODAL CONTROL
// ==============================

document.addEventListener("DOMContentLoaded", function () {
  const openMaps = document.getElementById("openMaps");
  const mapModal = document.getElementById("mapModal");
  const closeMaps = document.getElementById("closeMaps");

  console.log("Map Script Loaded");

  if (!openMaps || !mapModal || !closeMaps) {
    console.log("Map elements not found!");
    return;
  }

  openMaps.addEventListener("click", function (e) {
    e.preventDefault();
    mapModal.classList.add("active");
    console.log("Modal Opened");
  });

  closeMaps.addEventListener("click", function () {
    mapModal.classList.remove("active");
    console.log("Modal Closed");
  });

  window.addEventListener("click", function (e) {
    if (e.target === mapModal) {
      mapModal.classList.remove("active");
    }
  });
});
// ==============================
// MOBILE MENU
// ==============================

const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");

if (menuToggle && nav) {
  menuToggle.addEventListener("click", function () {
    nav.classList.toggle("active");
  });
}
