// توابع کمکی مشترک بین تمام endpoint های API

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function errorResponse(message, status = 400) {
  return json({ error: message }, status);
}

// تولید کد یکتای غیرقابل‌حدس برای لینک اختصاصی هر مشتری
export function generateCustomerCode() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789"; // بدون حروف/ارقام مشابه (l,1,o,0)
  let code = "";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// وضعیت موعد تعویض یک قطعه نسبت به امروز
export function dueStatus(nextDueDate) {
  if (!nextDueDate) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 14) return "soon";
  return "ok";
}
