import { json, errorResponse } from "../../_lib/utils.js";

// PUT /api/parts/:id
export async function onRequestPut({ params, request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("داده نامعتبر است");

  await env.DB.prepare(
    "UPDATE parts_replaced SET part_name = ?, next_due_date = ?, notes = ? WHERE id = ?"
  )
    .bind(body.part_name, body.next_due_date || null, body.notes || null, params.id)
    .run();

  return json({ ok: true });
}

// DELETE /api/parts/:id
export async function onRequestDelete({ params, env }) {
  await env.DB.prepare("DELETE FROM parts_replaced WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
