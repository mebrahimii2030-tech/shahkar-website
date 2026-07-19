/**
 * منوی کشویی جستجوپذیر ساده
 * از یک <input> و یک <div class="combo-list"> کنارش استفاده می‌کند.
 * source می‌تواند آرایه‌ی ساده رشته‌ها باشد، یا یک آبجکت گروه‌بندی‌شده { "گروه": ["مورد۱", ...] }
 *
 * initCombobox(inputEl, listEl, source, { onSelect, onGroupChange })
 */
function initCombobox(inputEl, listEl, source, opts = {}) {
  const isGrouped = !Array.isArray(source);

  function flatten(query) {
    const q = (query || "").trim().toLowerCase();
    const rows = [];

    if (isGrouped) {
      Object.keys(source).forEach((group) => {
        const items = (source[group] || []).filter((item) =>
          !q || item.toLowerCase().includes(q)
        );
        if (items.length) {
          rows.push({ type: "group", label: group });
          items.forEach((item) => rows.push({ type: "option", label: item, group }));
        }
      });
    } else {
      source
        .filter((item) => !q || item.toLowerCase().includes(q))
        .forEach((item) => rows.push({ type: "option", label: item }));
    }

    // اگر مقدار تایپ‌شده دقیقاً توی لیست نبود، گزینه‌ی «افزودن …» رو نشون بده
    const exactMatch = isGrouped
      ? Object.values(source).flat().some((v) => v.toLowerCase() === q)
      : source.some((v) => v.toLowerCase() === q);

    if (q && !exactMatch) {
      rows.push({ type: "add", label: query.trim() });
    }

    return rows;
  }

  function render(query) {
    const rows = flatten(query);
    if (!rows.length) {
      listEl.classList.remove("open");
      listEl.innerHTML = "";
      return;
    }

    listEl.innerHTML = rows
      .map((row) => {
        if (row.type === "group") {
          return `<div class="combo-group-label">${row.label}</div>`;
        }
        if (row.type === "add") {
          return `<div class="combo-option combo-option--add" data-value="${escapeHtml(row.label)}">+ افزودن «${escapeHtml(row.label)}»</div>`;
        }
        return `<div class="combo-option" data-value="${escapeHtml(row.label)}" data-group="${escapeHtml(row.group || "")}">${escapeHtml(row.label)}</div>`;
      })
      .join("");

    listEl.classList.add("open");

    listEl.querySelectorAll(".combo-option").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const value = el.getAttribute("data-value");
        const group = el.getAttribute("data-group");
        inputEl.value = value;
        listEl.classList.remove("open");
        if (opts.onSelect) opts.onSelect(value, group || null);
      });
    });
  }

  inputEl.addEventListener("input", () => render(inputEl.value));
  inputEl.addEventListener("focus", () => render(inputEl.value));
  inputEl.addEventListener("blur", () => {
    setTimeout(() => listEl.classList.remove("open"), 120);
  });

  document.addEventListener("click", (e) => {
    if (!listEl.contains(e.target) && e.target !== inputEl) {
      listEl.classList.remove("open");
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
