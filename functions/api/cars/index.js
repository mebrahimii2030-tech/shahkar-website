import { json, errorResponse } from "../../_lib/utils.js";

// POST /api/cars -> افزودن خودرو جدید به یک مشتری  { customer_code, brand, model, year, plate }
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body || !body.customer_code || !body.brand || !body.model) {
    return errorResponse("مشتری، برند و مدل خودرو الزامی است");
  }

  const customer = await env.DB.prepare("SELECT id FROM customers WHERE code = ?")
    .bind(body.customer_code)
    .first();
  if (!customer) return errorResponse("مشتری یافت نشد", 404);

  const result = await env.DB.prepare(
    "INSERT INTO cars (customer_id, brand, model, year, plate) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(customer.id, body.brand, body.model, body.year || null, body.plate || null)
    .run();

  return json({ id: result.meta.last_row_id });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
