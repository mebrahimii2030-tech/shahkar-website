import { json, errorResponse } from "../../_lib/utils.js";

// PUT /api/visits/:id -> ویرایش اطلاعات یک مراجعه (بدون قطعات - قطعات از /api/parts مدیریت می‌شوند)
export async function onRequestPut({ params, request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("داده نامعتبر است");

  await env.DB.prepare(
    "UPDATE visits SET visit_date = ?, complaints = ?, resolved = ?, notes = ? WHERE id = ?"
  )
    .bind(body.visit_date, body.complaints || null, body.resolved || null, body.notes || null, params.id)
    .run();

  return json({ ok: true });
}

// DELETE /api/visits/:id
export async function onRequestDelete({ params, env }) {
  await env.DB.prepare("DELETE FROM visits WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
