import { json, errorResponse } from "../../_lib/utils.js";

// GET /api/customers/:code -> اطلاعات کامل مشتری + خودروها + سوابق مراجعات + قطعات
export async function onRequestGet({ params, env }) {
  const customer = await env.DB.prepare("SELECT * FROM customers WHERE code = ?")
    .bind(params.code)
    .first();

  if (!customer) return errorResponse("مشتری یافت نشد", 404);

  const { results: cars } = await env.DB.prepare(
    "SELECT * FROM cars WHERE customer_id = ? ORDER BY created_at DESC"
  )
    .bind(customer.id)
    .all();

  for (const car of cars) {
    const { results: visits } = await env.DB.prepare(
      "SELECT * FROM visits WHERE car_id = ? ORDER BY visit_date DESC"
    )
      .bind(car.id)
      .all();

    for (const visit of visits) {
      const { results: parts } = await env.DB.prepare(
        "SELECT * FROM parts_replaced WHERE visit_id = ? ORDER BY id"
      )
        .bind(visit.id)
        .all();
      visit.parts = parts;
    }
    car.visits = visits;
  }

  customer.cars = cars;
  return json({ customer });
}

// PUT /api/customers/:code -> ویرایش اطلاعات مشتری
export async function onRequestPut({ params, request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("داده نامعتبر است");

  const customer = await env.DB.prepare("SELECT id FROM customers WHERE code = ?")
    .bind(params.code)
    .first();
  if (!customer) return errorResponse("مشتری یافت نشد", 404);

  await env.DB.prepare(
    "UPDATE customers SET first_name = ?, last_name = ?, phone = ? WHERE id = ?"
  )
    .bind(body.first_name, body.last_name, body.phone || null, customer.id)
    .run();

  return json({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,PUT,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
