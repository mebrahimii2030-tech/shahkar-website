// لایه ساده ارتباط با API پنل (Cloudflare Pages Functions)

// خواندن امن پاسخ سرور: اگر سرور به‌جای JSON یک صفحه‌ی خطا (مثلاً HTML ۵۰۰)
// برگرداند، به‌جای کرش‌کردن کل صفحه، یک خطای قابل‌فهم برمی‌گرداند
async function readPanelResponse(res) {
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  if (!res.ok) {
    const message = (data && data.error) || `خطا در ارتباط با سرور (کد ${res.status})`;
    return { error: message };
  }
  return data || {};
}

const PanelAPI = {
  async listCustomers() {
    const res = await fetch("/api/customers");
    return readPanelResponse(res);
  },
  async createCustomer(data) {
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readPanelResponse(res);
  },
  async getCustomer(code) {
    const res = await fetch(`/api/customers/${encodeURIComponent(code)}`);
    return readPanelResponse(res);
  },
  async updateCustomer(code, data) {
    const res = await fetch(`/api/customers/${encodeURIComponent(code)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readPanelResponse(res);
  },
  async deleteCustomer(code) {
    const res = await fetch(`/api/customers/${encodeURIComponent(code)}`, { method: "DELETE" });
    return readPanelResponse(res);
  },
  async addCar(data) {
    const res = await fetch("/api/cars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readPanelResponse(res);
  },
  async updateCar(id, data) {
    const res = await fetch(`/api/cars/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readPanelResponse(res);
  },
  async deleteCar(id) {
    const res = await fetch(`/api/cars/${id}`, { method: "DELETE" });
    return readPanelResponse(res);
  },
  async addVisit(data) {
    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readPanelResponse(res);
  },
  async updateVisit(id, data) {
    const res = await fetch(`/api/visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readPanelResponse(res);
  },
  async deleteVisit(id) {
    const res = await fetch(`/api/visits/${id}`, { method: "DELETE" });
    return readPanelResponse(res);
  },
  async deletePart(id) {
    const res = await fetch(`/api/parts/${id}`, { method: "DELETE" });
    return readPanelResponse(res);
  },
  async addPart(data) {
    const res = await fetch("/api/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readPanelResponse(res);
  },
  async updatePart(id, data) {
    const res = await fetch(`/api/parts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readPanelResponse(res);
  },
  async listReviewsAdmin() {
    const res = await fetch("/api/reviews/admin");
    return readPanelResponse(res);
  },
  async deleteReview(id) {
    const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    return readPanelResponse(res);
  },
  async listMessages() {
    const res = await fetch("/api/contact");
    return readPanelResponse(res);
  },
  async markMessageRead(id) {
    const res = await fetch(`/api/contact/${id}`, { method: "PUT" });
    return readPanelResponse(res);
  },
  async deleteMessage(id) {
    const res = await fetch(`/api/contact/${id}`, { method: "DELETE" });
    return readPanelResponse(res);
  },

  // ---------- مقالات وبلاگ ----------
  async listArticlesAdmin() {
    const res = await fetch("/api/articles/admin");
    return readPanelResponse(res);
  },
  async getArticle(id) {
    const res = await fetch(`/api/articles/${id}`);
    return readPanelResponse(res);
  },
  async createArticle(data) {
    const res = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readPanelResponse(res);
  },
  async updateArticle(id, data) {
    const res = await fetch(`/api/articles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readPanelResponse(res);
  },
  async deleteArticle(id) {
    const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
    return readPanelResponse(res);
  },
};
