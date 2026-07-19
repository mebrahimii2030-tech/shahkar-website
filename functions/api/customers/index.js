import { json, errorResponse, generateCustomerCode } from "../../_lib/utils.js";

// GET /api/customers  -> لیست همه مشتری‌ها برای صفحه مدیریت، به همراه نزدیک‌ترین موعد تعویض هر کدام
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `
    SELECT
      c.id, c.code, c.first_name, c.last_name, c.phone,
      MIN(p.next_due_date) AS nearest_due_date,
      COUNT(DISTINCT car.id) AS car_count
    FROM customers c
    LEFT JOIN cars car ON car.customer_id = c.id
    LEFT JOIN visits v ON v.car_id = car.id
    LEFT JOIN parts_replaced p ON p.visit_id = v.id AND p.next_due_date IS NOT NULL
    GROUP BY c.id
    ORDER BY
      CASE WHEN nearest_due_date IS NULL THEN 1 ELSE 0 END,
      nearest_due_date ASC
  `
  ).all();

  return json({ customers: results });
}

// POST /api/customers  -> ثبت مشتری جدید، بازگرداندن کد یکتای لینک اختصاصی
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body || !body.first_name || !body.last_name) {
    return errorResponse("نام و نام خانوادگی الزامی است");
  }

  let code = generateCustomerCode();
  // اطمینان از یکتا بودن کد (احتمال برخورد بسیار کم است ولی چک می‌کنیم)
  for (let i = 0; i < 5; i++) {
    const existing = await env.DB.prepare("SELECT id FROM customers WHERE code = ?")
      .bind(code)
      .first();
    if (!existing) break;
    code = generateCustomerCode();
  }

  const result = await env.DB.prepare(
    `INSERT INTO customers (code, first_name, last_name, phone) VALUES (?, ?, ?, ?)`
  )
    .bind(code, body.first_name, body.last_name, body.phone || null)
    .run();

  return json({
    id: result.meta.last_row_id,
    code,
    first_name: body.first_name,
    last_name: body.last_name,
    phone: body.phone || null,
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
