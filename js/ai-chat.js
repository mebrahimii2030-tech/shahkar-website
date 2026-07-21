// دستیار هوشمند شاهکار — رابط کاربری چت که به /api/chat روی همان Worker وصل می‌شود

(function () {
  const root = document.getElementById("ai-chat");
  const launcher = document.getElementById("ai-chat-launcher");
  const windowEl = document.getElementById("ai-chat-window");
  const closeBtn = document.getElementById("ai-chat-close");
  const messagesEl = document.getElementById("ai-chat-messages");
  const form = document.getElementById("ai-chat-form");
  const input = document.getElementById("ai-chat-input");

  if (!root || !launcher || !form) return;

  // تاریخچه‌ی مکالمه در همین بارگذاری صفحه (برای پاسخ‌های مرتبط با پیام قبلی)
  let history = [];

  function openChat() {
    root.classList.add("is-open");
    windowEl.hidden = false;
    input.focus();
  }

  function closeChat() {
    root.classList.remove("is-open");
    windowEl.hidden = true;
  }

  launcher.addEventListener("click", openChat);
  closeBtn.addEventListener("click", closeChat);

  // ---------- قابلیت جابه‌جایی چت (کشیدن از هدر) ----------
  const headEl = windowEl.querySelector(".ai-chat-head");
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  function onDragStart(e) {
    if (e.target.closest(".ai-chat-close")) return; // کلیک روی دکمه بستن نباید درگ حساب شود
    dragging = true;
    const rect = windowEl.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    windowEl.style.left = startLeft + "px";
    windowEl.style.top = startTop + "px";
    windowEl.style.right = "auto";
    windowEl.style.bottom = "auto";
    headEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const margin = 8;
    const maxLeft = window.innerWidth - windowEl.offsetWidth - margin;
    const maxTop = window.innerHeight - windowEl.offsetHeight - margin;
    const newLeft = Math.min(Math.max(margin, startLeft + dx), Math.max(margin, maxLeft));
    const newTop = Math.min(Math.max(margin, startTop + dy), Math.max(margin, maxTop));
    windowEl.style.left = newLeft + "px";
    windowEl.style.top = newTop + "px";
  }

  function onDragEnd() {
    dragging = false;
  }

  headEl.addEventListener("pointerdown", onDragStart);
  headEl.addEventListener("pointermove", onDragMove);
  headEl.addEventListener("pointerup", onDragEnd);
  headEl.addEventListener("pointercancel", onDragEnd);

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function addMessage(text, role) {
    const div = document.createElement("div");
    div.className = "ai-msg " + (role === "user" ? "ai-msg--user" : "ai-msg--bot");
    div.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function addTyping() {
    const div = document.createElement("div");
    div.className = "ai-msg ai-msg--typing";
    div.textContent = "در حال تایپ...";
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    addMessage(text, "user");
    history.push({ role: "user", content: text });
    input.value = "";
    input.disabled = true;

    const typingEl = addTyping();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(-10) }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        // پاسخ JSON نبود
      }

      typingEl.remove();

      if (!res.ok || !data || !data.reply) {
        addMessage(
          (data && data.error) ||
            "الان امکان پاسخ‌گویی نیست. می‌تونید مستقیم با شماره 09191389418 تماس بگیرید.",
          "bot"
        );
        return;
      }

      addMessage(data.reply, "bot");
      history.push({ role: "assistant", content: data.reply });
    } catch (err) {
      typingEl.remove();
      addMessage(
        "ارتباط برقرار نشد. می‌تونید مستقیم با شماره 09191389418 تماس بگیرید.",
        "bot"
      );
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
})();
