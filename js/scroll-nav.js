(function () {
  function init() {
    var wrap = document.createElement("div");
    wrap.className = "scroll-nav";
    wrap.id = "scrollNav";
    wrap.innerHTML =
      '<button id="scrollUpBtn" class="scroll-nav-btn" aria-label="برو به بالای صفحه"><i class="fa-solid fa-chevron-up"></i></button>' +
      '<button id="scrollDownBtn" class="scroll-nav-btn" aria-label="برو به پایین صفحه"><i class="fa-solid fa-chevron-down"></i></button>';
    document.body.appendChild(wrap);

    var upBtn = document.getElementById("scrollUpBtn");
    var downBtn = document.getElementById("scrollDownBtn");

    function docHeight() {
      return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
    }

    function update() {
      var scrollY = window.scrollY || window.pageYOffset;
      var atTop = scrollY < 80;
      var atBottom = scrollY + window.innerHeight >= docHeight() - 80;

      wrap.classList.toggle("visible", docHeight() > window.innerHeight + 200);
      upBtn.classList.toggle("disabled", atTop);
      downBtn.classList.toggle("disabled", atBottom);
    }

    upBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    downBtn.addEventListener("click", function () {
      window.scrollTo({ top: docHeight(), behavior: "smooth" });
    });

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          update();
          ticking = false;
        });
        ticking = true;
      }
    });

    window.addEventListener("resize", update);
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
