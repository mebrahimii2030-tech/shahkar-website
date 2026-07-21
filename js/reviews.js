// نمایش و ثبت دیدگاه مشتریان — نام برای همه نمایش داده می‌شود،
// شماره تماس فقط در پنل مدیریت قابل مشاهده است (هرگز در این فایل رندر نمی‌شود).

(function () {
  const listEl = document.getElementById("reviews-list");
  const emptyEl = document.getElementById("reviews-empty");
  const form = document.getElementById("review-form");
  const statusEl = document.getElementById("review-form-status");
  if (!listEl || !form) return;

  const submitBtn = form.querySelector(".send-btn");

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(raw) {
    if (!raw) return "";
    const datePart = String(raw).split(" ")[0];
    try {
      if (typeof isoToJalaliDisplay === "function") {
        const display = isoToJalaliDisplay(datePart);
        if (display) return display;
      }
    } catch (_) {
      // در صورت خطا از همان مقدار خام استفاده می‌شود
    }
    return datePart;
  }

  function reviewCardHtml(review) {
    const name = review.name ? String(review.name).trim() : "کاربر";
    const initial = name.charAt(0) || "؟";
    return `
      <div class="review-card">
        <div class="review-card-head">
          <div class="review-avatar">${escapeHtml(initial)}</div>
          <div class="review-name">${escapeHtml(name)}</div>
          <div class="review-date">${escapeHtml(formatDate(review.created_at))}</div>
        </div>
        <div class="review-comment">${escapeHtml(review.comment)}</div>
      </div>`;
  }

  function renderReviews(reviews) {
    if (!reviews || !reviews.length) {
      listEl.innerHTML = `<p class="reviews-empty" id="reviews-empty">هنوز دیدگاهی ثبت نشده است. اولین نفر باشید!</p>`;
      return;
    }
    listEl.innerHTML = reviews.map(reviewCardHtml).join("");
  }

  function prependReview(review) {
    if (emptyEl && listEl.contains(emptyEl)) {
      listEl.innerHTML = "";
    }
    listEl.insertAdjacentHTML("afterbegin", reviewCardHtml(review));
  }

  async function loadReviews() {
    try {
      const res = await fetch("/api/reviews");
      const data = await res.json();
      renderReviews(data.reviews || []);
    } catch (err) {
      listEl.innerHTML = `<p class="reviews-empty">خطا در بارگذاری دیدگاه‌ها. لطفاً صفحه را دوباره بارگذاری کنید.</p>`;
    }
  }

  function setStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove("is-success", "is-error");
    if (type) statusEl.classList.add(type === "success" ? "is-success" : "is-error");
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const comment = form.comment.value.trim();

    if (!name || !phone || !comment) {
      setStatus("لطفاً نام، شماره تماس و متن دیدگاه را کامل وارد کنید.", "error");
      return;
    }

    submitBtn.disabled = true;
    setStatus("در حال ثبت...", null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, comment }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        // پاسخ JSON نبود
      }

      if (!res.ok) {
        throw new Error((data && data.error) || "ثبت دیدگاه با خطا مواجه شد.");
      }

      prependReview({
        name,
        comment,
        created_at: new Date().toISOString().slice(0, 10),
      });

      form.reset();
      setStatus("دیدگاه شما با موفقیت ثبت شد. با تشکر از شما.", "success");
    } catch (err) {
      setStatus(err.message || "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadReviews();
})();
