let allArticles = [];

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPublishedDate(iso) {
  if (!iso) return "—";
  try {
    const display = isoToJalaliDisplay(iso);
    if (display) return display;
  } catch (_) {
    // در صورت خطا از مقدار خام استفاده می‌شود
  }
  return iso;
}

// ---------- خلاصه وضعیت ----------

function renderSummary() {
  const published = allArticles.filter((a) => a.is_published).length;
  const drafts = allArticles.filter((a) => !a.is_published).length;
  const featured = allArticles.filter((a) => a.is_featured).length;

  const box = (label, count, cls) => `
    <div class="due-pill due-pill--${cls}" style="font-size:15px; padding:10px 18px;">
      ${label}: ${count}
    </div>`;

  document.getElementById("blog-summary-boxes").innerHTML =
    box("مقاله منتشرشده", published, "ok") +
    box("پیش‌نویس", drafts, "soon") +
    box("مطلب ویژه", featured, "none");
}

// ---------- جدول مقالات ----------

function renderTable(list) {
  const tbody = document.getElementById("articles-tbody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">هنوز مقاله‌ای ثبت نشده است</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((a) => {
      const badges = `
        <div class="status-badges">
          <span class="due-pill due-pill--${a.is_published ? "ok" : "soon"}">${a.is_published ? "منتشرشده" : "پیش‌نویس"}</span>
          ${a.is_featured ? `<span class="due-pill due-pill--none">ویژه</span>` : ""}
        </div>`;
      return `
        <tr>
          <td class="article-title-cell">
            <span class="customer-name">${escapeHtml(a.title)}</span>
            ${a.excerpt ? `<span class="article-excerpt">${escapeHtml(a.excerpt)}</span>` : ""}
          </td>
          <td>${escapeHtml(a.category)}</td>
          <td>${formatPublishedDate(a.published_date)}</td>
          <td>${badges}</td>
          <td>
            <button class="copy-link-btn" onclick="openEditArticle(${a.id})">ویرایش</button>
            <button class="copy-link-btn copy-link-btn--danger" onclick="handleDeleteArticle(${a.id})">حذف</button>
          </td>
        </tr>`;
    })
    .join("");
}

function renderCategoryOptions() {
  const categories = [...new Set(allArticles.map((a) => a.category).filter(Boolean))];
  document.getElementById("category-options").innerHTML = categories
    .map((c) => `<option value="${escapeHtml(c)}"></option>`)
    .join("");
}

// ---------- فرم افزودن/ویرایش ----------

const form = document.getElementById("article-form");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("article-submit-btn");
const cancelBtn = document.getElementById("cancel-edit-btn");
const newArticleBtn = document.getElementById("new-article-btn");

function resetForm() {
  form.reset();
  form.id.value = "";
  form.published_date.value = isoToJalaliDisplay(todayIso());
  form.author.value = "تیم فنی شاهکار";
  form.is_published.checked = true;
  form.is_featured.checked = false;
  formTitle.textContent = "افزودن مقاله جدید";
  submitBtn.textContent = "ثبت مقاله";
  cancelBtn.hidden = true;
  newArticleBtn.hidden = true;
}

function openEditArticle(id) {
  const a = allArticles.find((x) => x.id === id);
  if (!a) return;
  form.id.value = a.id;
  form.title.value = a.title;
  form.category.value = a.category;
  form.icon.value = a.icon || "fa-solid fa-newspaper";
  form.excerpt.value = a.excerpt || "";
  form.content.value = a.content;
  form.author.value = a.author || "تیم فنی شاهکار";
  form.read_minutes.value = a.read_minutes || "";
  form.published_date.value = isoToJalaliDisplay(a.published_date);
  form.is_published.checked = !!a.is_published;
  form.is_featured.checked = !!a.is_featured;

  formTitle.textContent = `ویرایش مقاله: ${a.title}`;
  submitBtn.textContent = "ذخیره تغییرات";
  cancelBtn.hidden = false;
  newArticleBtn.hidden = false;

  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

cancelBtn.addEventListener("click", resetForm);
newArticleBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = form.id.value;
  const publishedIso = jalaliInputToIso(form.published_date.value.trim());
  if (!publishedIso) {
    alert("تاریخ انتشار را به‌درستی و به‌صورت شمسی وارد کن، مثلاً 1404/05/20");
    return;
  }

  const data = {
    title: form.title.value.trim(),
    category: form.category.value.trim(),
    icon: form.icon.value,
    excerpt: form.excerpt.value.trim(),
    content: form.content.value.trim(),
    author: form.author.value.trim(),
    read_minutes: form.read_minutes.value ? parseInt(form.read_minutes.value, 10) : null,
    published_date: publishedIso,
    is_published: form.is_published.checked,
    is_featured: form.is_featured.checked,
  };

  if (!data.title || !data.category || !data.content) {
    alert("عنوان، دسته‌بندی و متن مقاله الزامی است");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.classList.add("btn-loading");

  let result;
  if (id) {
    result = await PanelAPI.updateArticle(id, data);
  } else {
    result = await PanelAPI.createArticle(data);
  }

  submitBtn.disabled = false;
  submitBtn.classList.remove("btn-loading");

  if (result && result.error) {
    alert(result.error);
    return;
  }

  resetForm();
  await loadArticles();
});

async function handleDeleteArticle(id) {
  const a = allArticles.find((x) => x.id === id);
  const title = a ? a.title : "این مقاله";
  const sure = confirm(`آیا مطمئن هستی می‌خواهی «${title}» را حذف کنی؟ این کار غیرقابل‌بازگشت است.`);
  if (!sure) return;

  const result = await PanelAPI.deleteArticle(id);
  if (result && result.error) {
    alert(result.error);
    return;
  }
  await loadArticles();
}

document.getElementById("search-box").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = allArticles.filter(
    (a) => a.title.toLowerCase().includes(q) || (a.category || "").toLowerCase().includes(q)
  );
  renderTable(filtered);
});

async function loadArticles() {
  const data = await PanelAPI.listArticlesAdmin();
  allArticles = data.articles || [];
  renderSummary();
  renderTable(allArticles);
  renderCategoryOptions();
}

resetForm();
loadArticles();
