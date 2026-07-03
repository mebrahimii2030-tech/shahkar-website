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
ظظ;
