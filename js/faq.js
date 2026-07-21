// باز/بسته‌کردن آکاردئون سوالات متداول

(function () {
  const items = document.querySelectorAll(".faq-item");

  items.forEach((item) => {
    const question = item.querySelector(".faq-question");
    if (!question) return;

    question.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");

      items.forEach((other) => other.classList.remove("is-open"));

      if (!isOpen) {
        item.classList.add("is-open");
      }
    });
  });
})();
