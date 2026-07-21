// ارسال فرم تماس با ما به API واقعی (Cloudflare Worker + D1)

(function () {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const statusEl = document.getElementById("contact-form-status");
  const submitBtn = form.querySelector(".send-btn");

  function setStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove("is-success", "is-error");
    if (type) statusEl.classList.add(type === "success" ? "is-success" : "is-error");
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = form.name.value.trim();
    const body = form.body.value.trim();

    if (!name || !body) {
      setStatus("لطفاً نام و متن پیام را وارد کنید.", "error");
      return;
    }

    const payload = {
      name,
      phone: form.phone.value.trim() || null,
      email: form.email.value.trim() || null,
      subject: form.subject.value.trim() || null,
      body,
    };

    submitBtn.disabled = true;
    setStatus("در حال ارسال...", null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        // پاسخ JSON نبود
      }

      if (!res.ok) {
        throw new Error((data && data.error) || "ارسال پیام با خطا مواجه شد.");
      }

      form.reset();
      setStatus("پیام شما با موفقیت ارسال شد. به‌زودی با شما تماس می‌گیریم.", "success");
    } catch (err) {
      setStatus(err.message || "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
