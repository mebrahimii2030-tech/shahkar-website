// لایه ساده ارتباط با API پنل (Cloudflare Pages Functions)

const PanelAPI = {
  async listCustomers() {
    const res = await fetch("/api/customers");
    return res.json();
  },
  async createCustomer(data) {
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async getCustomer(code) {
    const res = await fetch(`/api/customers/${encodeURIComponent(code)}`);
    return res.json();
  },
  async updateCustomer(code, data) {
    const res = await fetch(`/api/customers/${encodeURIComponent(code)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async addCar(data) {
    const res = await fetch("/api/cars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateCar(id, data) {
    const res = await fetch(`/api/cars/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteCar(id) {
    const res = await fetch(`/api/cars/${id}`, { method: "DELETE" });
    return res.json();
  },
  async addVisit(data) {
    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateVisit(id, data) {
    const res = await fetch(`/api/visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteVisit(id) {
    const res = await fetch(`/api/visits/${id}`, { method: "DELETE" });
    return res.json();
  },
  async deletePart(id) {
    const res = await fetch(`/api/parts/${id}`, { method: "DELETE" });
    return res.json();
  },
  async listReviewsAdmin() {
    const res = await fetch("/api/reviews/admin");
    return res.json();
  },
  async deleteReview(id) {
    const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    return res.json();
  },
  async listMessages() {
    const res = await fetch("/api/contact");
    return res.json();
  },
  async markMessageRead(id) {
    const res = await fetch(`/api/contact/${id}`, { method: "PUT" });
    return res.json();
  },
  async deleteMessage(id) {
    const res = await fetch(`/api/contact/${id}`, { method: "DELETE" });
    return res.json();
  },
};
