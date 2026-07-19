import { json, errorResponse } from "../../_lib/utils.js";

// PUT /api/cars/:id -> ویرایش خودرو
export async function onRequestPut({ params, request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("داده نامعتبر است");

  await env.DB.prepare(
    "UPDATE cars SET brand = ?, model = ?, year = ?, plate = ? WHERE id = ?"
  )
    .bind(body.brand, body.model, body.year || null, body.plate || null, params.id)
    .run();

  return json({ ok: true });
}

// DELETE /api/cars/:id -> حذف خودرو (و به‌طبع آن سوابق مراجعات و قطعات مرتبط)
export async function onRequestDelete({ params, env }) {
  await env.DB.prepare("DELETE FROM cars WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
