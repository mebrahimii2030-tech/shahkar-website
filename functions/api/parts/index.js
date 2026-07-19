import { json, errorResponse } from "../../_lib/utils.js";

// POST /api/parts -> افزودن یک قطعه تعویض‌شده به یک مراجعه موجود
// body: { visit_id, part_name, next_due_date, notes }
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body || !body.visit_id || !body.part_name) {
    return errorResponse("مراجعه و نام قطعه الزامی است");
  }

  const result = await env.DB.prepare(
    "INSERT INTO parts_replaced (visit_id, part_name, next_due_date, notes) VALUES (?, ?, ?, ?)"
  )
    .bind(body.visit_id, body.part_name, body.next_due_date || null, body.notes || null)
    .run();

  return json({ id: result.meta.last_row_id });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
