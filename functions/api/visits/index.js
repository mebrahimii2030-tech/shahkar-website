import { json, errorResponse } from "../../_lib/utils.js";

// POST /api/visits
// body: { car_id, visit_date, complaints, resolved, notes, parts: [{ part_name, next_due_date, notes }] }
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body || !body.car_id || !body.visit_date) {
    return errorResponse("خودرو و تاریخ مراجعه الزامی است");
  }

  const visitResult = await env.DB.prepare(
    "INSERT INTO visits (car_id, visit_date, complaints, resolved, notes) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(body.car_id, body.visit_date, body.complaints || null, body.resolved || null, body.notes || null)
    .run();

  const visitId = visitResult.meta.last_row_id;

  const parts = Array.isArray(body.parts) ? body.parts : [];
  for (const part of parts) {
    if (!part.part_name) continue;
    await env.DB.prepare(
      "INSERT INTO parts_replaced (visit_id, part_name, next_due_date, notes) VALUES (?, ?, ?, ?)"
    )
      .bind(visitId, part.part_name, part.next_due_date || null, part.notes || null)
      .run();
  }

  return json({ id: visitId });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
