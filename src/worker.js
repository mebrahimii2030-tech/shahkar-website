// =====================================================
// شماکار | ورکر اصلی سایت (Cloudflare Workers + Static Assets)
// این فایل جایگزین پوشه‌ی قدیمی functions/ شده، چون آن ساختار
// فقط برای Cloudflare Pages کار می‌کند، نه برای Cloudflare Workers.
// طبق wrangler.jsonc، فقط درخواست‌های /api/* و صفحات پنل مدیریت
// از همین فایل عبور می‌کنند؛ بقیه فایل‌های سایت مستقیم و رایگان
// از لایه Static Assets سرو می‌شوند.
// =====================================================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(message, status = 400) {
  return json({ error: message }, status);
}

function generateCustomerCode() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let code = "";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) code += chars[bytes[i] % chars.length];
  return code;
}

// ---------- بررسی نشست ورود مدیر (کوکی امضاشده به‌جای پنجره Basic Auth مرورگر) ----------

const SESSION_COOKIE_NAME = "shahkar_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // ۱۲ ساعت

async function hmacHex(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractSessionCookie(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function createSessionCookieValue(env) {
  const expiry = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const sig = await hmacHex(String(expiry), env.ADMIN_PASSWORD);
  return `${expiry}.${sig}`;
}

async function isAuthorized(request, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return false;
  const cookieValue = extractSessionCookie(request);
  if (!cookieValue) return false;
  const dot = cookieValue.indexOf(".");
  if (dot < 0) return false;
  const expiry = Number(cookieValue.slice(0, dot));
  const sig = cookieValue.slice(dot + 1);
  if (!expiry || Number.isNaN(expiry) || Date.now() > expiry) return false;
  const expectedSig = await hmacHex(String(expiry), expected);
  return sig === expectedSig;
}

function unauthorizedApiResponse() {
  return errorResponse("دسترسی غیرمجاز. لطفاً دوباره وارد پنل مدیریت شوید.", 401);
}

// ---------- تاریخچه ورود مدیر (ثبت زمان ورود + تشخیص ورود مشکوک) ----------

function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "نامشخص";
}

function getUserAgent(request) {
  return (request.headers.get("User-Agent") || "نامشخص").slice(0, 300);
}

// جدول admin_logins ممکن است روی دیتابیس‌های قدیمی‌تر که هنوز مهاجرت
// migration-add-admin-security.sql را اجرا نکرده‌اند وجود نداشته باشد؛
// به همین دلیل همه‌ی توابع این بخش خطا را می‌بلعند تا ورود به پنل مختل نشود.

async function recordLoginAttempt(env, { username, ip, userAgent, success, isSuspicious }) {
  try {
    await env.DB.prepare(
      "INSERT INTO admin_logins (username, ip, user_agent, success, is_suspicious) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(username || "", ip, userAgent, success ? 1 : 0, isSuspicious ? 1 : 0)
      .run();
  } catch (_) {
    // بدون جدول مهاجرت‌نشده، فقط از ثبت تاریخچه صرف‌نظر می‌کنیم
  }
}

async function getRecentSuccessfulLogins(env, limit = 2) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT username, ip, user_agent, is_suspicious, created_at FROM admin_logins WHERE success = 1 ORDER BY created_at DESC, id DESC LIMIT ?"
    )
      .bind(limit)
      .all();
    return results || [];
  } catch (_) {
    return [];
  }
}

async function handleAdminSecurityInfo(env) {
  const rows = await getRecentSuccessfulLogins(env, 2);
  const current = rows[0] || null;
  const previous = rows[1] || null;
  return json({
    lastLogin: current ? current.created_at : null,
    lastLoginIp: current ? current.ip : null,
    suspicious: current ? !!current.is_suspicious : false,
    previousLogin: previous ? previous.created_at : null,
  });
}

// ---------- آمار بازدید سایت و پنل مدیریت ----------

// جدول page_views ممکن است روی دیتابیس‌های قدیمی‌تر که هنوز مهاجرت
// migration-add-page-views.sql را اجرا نکرده‌اند وجود نداشته باشد؛ به همین
// دلیل خطای احتمالی را می‌بلعیم تا بارگذاری صفحه برای بازدیدکننده مختل نشود.

async function handleTrackPageView(request, env) {
  const body = await request.json().catch(() => null);
  const path = body && typeof body.path === "string" ? body.path.slice(0, 200) : "";
  if (!path) return json({ ok: true }); // چیزی برای ثبت نیست، ولی خطا هم برنمی‌گردانیم
  const referrer = body && typeof body.referrer === "string" ? body.referrer.slice(0, 300) : null;
  const isPanel = !!(body && body.is_panel);
  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);
  try {
    await env.DB.prepare(
      "INSERT INTO page_views (path, referrer, ip, user_agent, is_panel) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(path, referrer, ip, userAgent, isPanel ? 1 : 0)
      .run();
  } catch (_) {
    // بدون جدول مهاجرت‌نشده، فقط از ثبت آمار صرف‌نظر می‌کنیم
  }
  return json({ ok: true });
}

async function handleAdminAnalytics(env) {
  const empty = {
    totalViews: 0,
    todayViews: 0,
    last7DaysViews: 0,
    panelViews: 0,
    panelViewsToday: 0,
    topPages: [],
  };
  try {
    const totalRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM page_views").first();
    const todayRow = await env.DB
      .prepare("SELECT COUNT(*) AS c FROM page_views WHERE created_at >= datetime('now', 'start of day')")
      .first();
    const last7Row = await env.DB
      .prepare("SELECT COUNT(*) AS c FROM page_views WHERE created_at >= datetime('now', '-7 days')")
      .first();
    const panelRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM page_views WHERE is_panel = 1").first();
    const panelTodayRow = await env.DB
      .prepare(
        "SELECT COUNT(*) AS c FROM page_views WHERE is_panel = 1 AND created_at >= datetime('now', 'start of day')"
      )
      .first();
    const { results: topPages } = await env.DB
      .prepare(
        "SELECT path, COUNT(*) AS views FROM page_views WHERE is_panel = 0 GROUP BY path ORDER BY views DESC LIMIT 8"
      )
      .all();

    return json({
      totalViews: totalRow?.c || 0,
      todayViews: todayRow?.c || 0,
      last7DaysViews: last7Row?.c || 0,
      panelViews: panelRow?.c || 0,
      panelViewsToday: panelTodayRow?.c || 0,
      topPages: topPages || [],
    });
  } catch (_) {
    // اگر جدول هنوز ساخته نشده (مهاجرت اجرا نشده)، صفر برمی‌گردانیم نه خطا
    return json(empty);
  }
}

async function handleAdminLogin(request, env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    return errorResponse(
      "دسترسی به پنل مدیریت پیکربندی نشده است. متغیرهای ADMIN_USERNAME و ADMIN_PASSWORD را در Settings پروژه Worker تعریف کنید.",
      503
    );
  }
  const body = await request.json().catch(() => null);
  const username = body && typeof body.username === "string" ? body.username.trim() : "";
  const password = body && typeof body.password === "string" ? body.password : "";
  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);

  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    await recordLoginAttempt(env, { username: username || "(خالی)", ip, userAgent, success: false, isSuspicious: false });
    return errorResponse("نام کاربری یا رمز عبور اشتباه است.", 401);
  }

  // ورود موفق قبلی را قبل از ثبت ورود فعلی می‌خوانیم تا بشود آدرس آن را با آدرس فعلی مقایسه کرد
  const previousLogins = await getRecentSuccessfulLogins(env, 1);
  const previousLogin = previousLogins[0] || null;
  const isSuspicious = !!(previousLogin && previousLogin.ip && previousLogin.ip !== "نامشخص" && previousLogin.ip !== ip);

  await recordLoginAttempt(env, { username, ip, userAgent, success: true, isSuspicious });

  const cookieValue = await createSessionCookieValue(env);
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`
  );
  return new Response(
    JSON.stringify({
      ok: true,
      security: {
        lastLogin: previousLogin ? previousLogin.created_at : null,
        suspicious: isSuspicious,
      },
    }),
    { status: 200, headers }
  );
}

function handleAdminLogout() {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

// ---------- منطق هر endpoint ----------

async function listCustomers(env) {
  // موعد فقط بر اساس کارکرد (کیلومتر) سنجیده می‌شود:
  // باقیمانده = next_due_mileage قطعه - current_mileage خودرو
  // هرچه این عدد کمتر (یا منفی‌تر) باشد، فوریت بیشتر است.
  const { results } = await env.DB.prepare(
    `
    SELECT
      c.id, c.code, c.first_name, c.last_name, c.phone,
      MIN(p.next_due_mileage - car.current_mileage) AS nearest_remaining_km,
      COUNT(DISTINCT car.id) AS car_count
    FROM customers c
    LEFT JOIN cars car ON car.customer_id = c.id
    LEFT JOIN visits v ON v.car_id = car.id
    LEFT JOIN parts_replaced p
      ON p.visit_id = v.id
      AND p.next_due_mileage IS NOT NULL
      AND car.current_mileage IS NOT NULL
    GROUP BY c.id
    ORDER BY CASE WHEN nearest_remaining_km IS NULL THEN 1 ELSE 0 END, nearest_remaining_km ASC
  `
  ).all();
  return json({ customers: results });
}

async function createCustomer(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.first_name || !body.last_name) {
    return errorResponse("نام و نام خانوادگی الزامی است");
  }
  let code = generateCustomerCode();
  for (let i = 0; i < 5; i++) {
    const existing = await env.DB.prepare("SELECT id FROM customers WHERE code = ?").bind(code).first();
    if (!existing) break;
    code = generateCustomerCode();
  }
  const result = await env.DB.prepare(
    "INSERT INTO customers (code, first_name, last_name, phone) VALUES (?, ?, ?, ?)"
  )
    .bind(code, body.first_name, body.last_name, body.phone || null)
    .run();
  return json({ id: result.meta.last_row_id, code, first_name: body.first_name, last_name: body.last_name, phone: body.phone || null });
}

async function getCustomer(code, env) {
  const customer = await env.DB.prepare("SELECT * FROM customers WHERE code = ?").bind(code).first();
  if (!customer) return errorResponse("مشتری یافت نشد", 404);

  const { results: cars } = await env.DB.prepare("SELECT * FROM cars WHERE customer_id = ? ORDER BY created_at DESC").bind(customer.id).all();
  for (const car of cars) {
    const { results: visits } = await env.DB.prepare("SELECT * FROM visits WHERE car_id = ? ORDER BY visit_date DESC").bind(car.id).all();
    for (const visit of visits) {
      const { results: parts } = await env.DB.prepare("SELECT * FROM parts_replaced WHERE visit_id = ? ORDER BY id").bind(visit.id).all();
      visit.parts = parts;
    }
    car.visits = visits;
  }
  customer.cars = cars;
  return json({ customer });
}

async function updateCustomer(code, request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("داده نامعتبر است");
  const customer = await env.DB.prepare("SELECT id FROM customers WHERE code = ?").bind(code).first();
  if (!customer) return errorResponse("مشتری یافت نشد", 404);
  await env.DB.prepare("UPDATE customers SET first_name = ?, last_name = ?, phone = ? WHERE id = ?")
    .bind(body.first_name, body.last_name, body.phone || null, customer.id)
    .run();
  return json({ ok: true });
}

// حذف کامل مشتری و تمام سوابق وابسته (خودروها، مراجعات، قطعات تعویض‌شده)
// به‌صورت صریح و در قالب یک تراکنش، تا مستقل از تنظیم فعال بودن FOREIGN KEYS
// در D1، هیچ ردی از اطلاعات این مشتری در هیچ‌کدام از جدول‌ها باقی نماند
async function deleteCustomer(code, env) {
  const customer = await env.DB.prepare("SELECT id FROM customers WHERE code = ?").bind(code).first();
  if (!customer) return errorResponse("مشتری یافت نشد", 404);
  const customerId = customer.id;

  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM parts_replaced WHERE visit_id IN (
         SELECT v.id FROM visits v JOIN cars c ON c.id = v.car_id WHERE c.customer_id = ?
       )`
    ).bind(customerId),
    env.DB.prepare(
      `DELETE FROM visits WHERE car_id IN (SELECT id FROM cars WHERE customer_id = ?)`
    ).bind(customerId),
    env.DB.prepare(`DELETE FROM cars WHERE customer_id = ?`).bind(customerId),
    env.DB.prepare(`DELETE FROM customers WHERE id = ?`).bind(customerId),
  ]);

  return json({ ok: true });
}

async function addCar(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.customer_code || !body.brand || !body.model) {
    return errorResponse("مشتری، برند و مدل خودرو الزامی است");
  }
  const customer = await env.DB.prepare("SELECT id FROM customers WHERE code = ?").bind(body.customer_code).first();
  if (!customer) return errorResponse("مشتری یافت نشد", 404);
  const result = await env.DB.prepare("INSERT INTO cars (customer_id, brand, model, year, plate) VALUES (?, ?, ?, ?, ?)")
    .bind(customer.id, body.brand, body.model, body.year || null, body.plate || null)
    .run();
  return json({ id: result.meta.last_row_id });
}

async function updateCar(id, request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("داده نامعتبر است");
  const hasMileage = body.current_mileage !== undefined && body.current_mileage !== null && body.current_mileage !== "";
  await env.DB.prepare(
    "UPDATE cars SET brand = ?, model = ?, year = ?, plate = ?, current_mileage = COALESCE(?, current_mileage) WHERE id = ?"
  )
    .bind(body.brand, body.model, body.year || null, body.plate || null, hasMileage ? body.current_mileage : null, id)
    .run();
  return json({ ok: true });
}

async function deleteCar(id, env) {
  await env.DB.prepare("DELETE FROM cars WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function addVisit(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.car_id || !body.visit_date) return errorResponse("خودرو و تاریخ مراجعه الزامی است");
  const visitResult = await env.DB.prepare(
    "INSERT INTO visits (car_id, visit_date, complaints, resolved, notes) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(body.car_id, body.visit_date, body.complaints || null, body.resolved || null, body.notes || null)
    .run();
  const visitId = visitResult.meta.last_row_id;

  // ثبت کارکرد فعلی خودرو در لحظه این مراجعه؛ همین مقدار بعداً برای محاسبه
  // موعد تعویض بر اساس کیلومتر (به‌جای تاریخ) استفاده می‌شود
  if (body.current_mileage !== undefined && body.current_mileage !== null && body.current_mileage !== "") {
    await env.DB.prepare("UPDATE cars SET current_mileage = ? WHERE id = ?")
      .bind(body.current_mileage, body.car_id)
      .run();
  }

  const parts = Array.isArray(body.parts) ? body.parts : [];
  for (const part of parts) {
    if (!part.part_name) continue;
    await env.DB.prepare(
      "INSERT INTO parts_replaced (visit_id, part_name, replaced_at_mileage, next_due_mileage, notes) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(visitId, part.part_name, part.replaced_at_mileage ?? null, part.next_due_mileage ?? null, part.notes || null)
      .run();
  }
  return json({ id: visitId });
}

async function updateVisit(id, request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("داده نامعتبر است");
  await env.DB.prepare("UPDATE visits SET visit_date = ?, complaints = ?, resolved = ?, notes = ? WHERE id = ?")
    .bind(body.visit_date, body.complaints || null, body.resolved || null, body.notes || null, id)
    .run();

  // اگر هنگام ویرایش مراجعه، کارکرد خودرو هم وارد/تغییر داده شده، همان‌طور
  // که در ثبت مراجعه جدید انجام می‌شود، کارکرد فعلی خودرو هم به‌روزرسانی شود
  if (body.car_id && body.current_mileage !== undefined && body.current_mileage !== null && body.current_mileage !== "") {
    await env.DB.prepare("UPDATE cars SET current_mileage = ? WHERE id = ?")
      .bind(body.current_mileage, body.car_id)
      .run();
  }

  return json({ ok: true });
}

async function deleteVisit(id, env) {
  await env.DB.prepare("DELETE FROM visits WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function addPart(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.visit_id || !body.part_name) return errorResponse("مراجعه و نام قطعه الزامی است");
  const result = await env.DB.prepare(
    "INSERT INTO parts_replaced (visit_id, part_name, replaced_at_mileage, next_due_mileage, notes) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(body.visit_id, body.part_name, body.replaced_at_mileage ?? null, body.next_due_mileage ?? null, body.notes || null)
    .run();
  return json({ id: result.meta.last_row_id });
}

async function updatePart(id, request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("داده نامعتبر است");
  await env.DB.prepare(
    "UPDATE parts_replaced SET part_name = ?, replaced_at_mileage = ?, next_due_mileage = ?, notes = ? WHERE id = ?"
  )
    .bind(body.part_name, body.replaced_at_mileage ?? null, body.next_due_mileage ?? null, body.notes || null, id)
    .run();
  return json({ ok: true });
}

async function deletePart(id, env) {
  await env.DB.prepare("DELETE FROM parts_replaced WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function createMessage(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.name || !body.body) {
    return errorResponse("نام و متن پیام الزامی است");
  }
  if (String(body.name).length > 200 || String(body.body).length > 5000) {
    return errorResponse("طول ورودی مجاز نیست");
  }
  const result = await env.DB.prepare(
    "INSERT INTO messages (name, phone, email, subject, body) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(body.name, body.phone || null, body.email || null, body.subject || null, body.body)
    .run();
  return json({ id: result.meta.last_row_id });
}

async function listMessages(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM messages ORDER BY created_at DESC"
  ).all();
  return json({ messages: results });
}

async function listPublicMessages(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, subject, body, created_at FROM messages ORDER BY created_at DESC LIMIT 50"
  ).all();
  return json({ messages: results });
}

async function markMessageRead(id, env) {
  await env.DB.prepare("UPDATE messages SET is_read = 1 WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function deleteMessage(id, env) {
  await env.DB.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function createReview(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.name || !body.phone || !body.comment) {
    return errorResponse("نام، شماره تماس و متن دیدگاه الزامی است");
  }
  if (String(body.name).length > 100 || String(body.phone).length > 30 || String(body.comment).length > 2000) {
    return errorResponse("طول ورودی مجاز نیست");
  }
  const result = await env.DB.prepare(
    "INSERT INTO reviews (name, phone, comment) VALUES (?, ?, ?)"
  )
    .bind(body.name, body.phone, body.comment)
    .run();
  return json({ id: result.meta.last_row_id });
}

// نسخه عمومی: فقط نام و متن دیدگاه؛ شماره تماس هرگز به این مسیر برنمی‌گردد
async function listReviewsPublic(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, comment, created_at FROM reviews ORDER BY created_at DESC LIMIT 100"
  ).all();
  return json({ reviews: results });
}

// نسخه مدیریتی: شامل شماره تماس، فقط با رمز عبور مدیر
async function listReviewsAdmin(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM reviews ORDER BY created_at DESC"
  ).all();
  return json({ reviews: results });
}

async function deleteReview(id, env) {
  await env.DB.prepare("DELETE FROM reviews WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

// ---------- مقالات وبلاگ ----------

function generateArticleSlug() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let code = "";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) code += chars[bytes[i] % chars.length];
  return code;
}

// نسخه عمومی: فقط مقالات منتشرشده، برای صفحه وبلاگ سایت
async function listArticlesPublic(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, slug, title, excerpt, content, category, icon, author, read_minutes, is_featured, published_date FROM articles WHERE is_published = 1 ORDER BY published_date DESC, id DESC"
  ).all();
  return json({ articles: results });
}

// نسخه مدیریتی: همه مقالات (شامل پیش‌نویس‌ها)، فقط با رمز عبور مدیر
async function listArticlesAdmin(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM articles ORDER BY published_date DESC, id DESC"
  ).all();
  return json({ articles: results });
}

async function getArticleById(id, env) {
  const article = await env.DB.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first();
  if (!article) return errorResponse("مقاله یافت نشد", 404);
  return json({ article });
}

async function getArticleBySlug(slug, env) {
  const article = await env.DB.prepare(
    "SELECT id, slug, title, excerpt, content, category, icon, author, read_minutes, is_featured, published_date FROM articles WHERE slug = ? AND is_published = 1"
  )
    .bind(slug)
    .first();
  if (!article) return errorResponse("مقاله یافت نشد", 404);
  return json({ article });
}

function sanitizeArticleBody(body) {
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  const category = String(body.category || "").trim();
  const published_date = String(body.published_date || "").trim();
  if (!title || !content || !category || !published_date) return null;
  return {
    title,
    excerpt: body.excerpt ? String(body.excerpt).trim().slice(0, 500) : null,
    content,
    category,
    icon: body.icon ? String(body.icon).trim() : "fa-solid fa-newspaper",
    author: body.author ? String(body.author).trim() : "تیم فنی شاهکار",
    read_minutes: body.read_minutes ? parseInt(body.read_minutes, 10) || null : null,
    is_featured: body.is_featured ? 1 : 0,
    is_published: body.is_published === false || body.is_published === 0 ? 0 : 1,
    published_date,
  };
}

async function createArticle(request, env) {
  const raw = await request.json().catch(() => null);
  if (!raw) return errorResponse("داده نامعتبر است");
  const a = sanitizeArticleBody(raw);
  if (!a) return errorResponse("عنوان، متن، دسته‌بندی و تاریخ انتشار الزامی است");

  let slug = generateArticleSlug();
  for (let i = 0; i < 5; i++) {
    const existing = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?").bind(slug).first();
    if (!existing) break;
    slug = generateArticleSlug();
  }

  const result = await env.DB.prepare(
    `INSERT INTO articles (slug, title, excerpt, content, category, icon, author, read_minutes, is_featured, is_published, published_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(slug, a.title, a.excerpt, a.content, a.category, a.icon, a.author, a.read_minutes, a.is_featured, a.is_published, a.published_date)
    .run();

  return json({ id: result.meta.last_row_id, slug });
}

async function updateArticle(id, request, env) {
  const raw = await request.json().catch(() => null);
  if (!raw) return errorResponse("داده نامعتبر است");
  const a = sanitizeArticleBody(raw);
  if (!a) return errorResponse("عنوان، متن، دسته‌بندی و تاریخ انتشار الزامی است");

  const existing = await env.DB.prepare("SELECT id FROM articles WHERE id = ?").bind(id).first();
  if (!existing) return errorResponse("مقاله یافت نشد", 404);

  await env.DB.prepare(
    `UPDATE articles SET title = ?, excerpt = ?, content = ?, category = ?, icon = ?, author = ?,
       read_minutes = ?, is_featured = ?, is_published = ?, published_date = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(a.title, a.excerpt, a.content, a.category, a.icon, a.author, a.read_minutes, a.is_featured, a.is_published, a.published_date, id)
    .run();

  return json({ ok: true });
}

async function deleteArticle(id, env) {
  await env.DB.prepare("DELETE FROM articles WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

// ---------- دستیار هوشمند (چت متصل به هوش مصنوعی) ----------

const CHAT_SYSTEM_PROMPT = `شما دستیار هوشمند و متخصص فنی سایت «تعمیرگاه تخصصی شاهکار» هستید؛ یک کارشناس مکانیک باتجربه که با جزئیات و در سطح تخصصی توضیح می‌دهد.
وظیفه شما پاسخ‌گویی کامل، دقیق و آموزنده به فارسی روان و مؤدبانه است. از جواب‌های تک‌خطی و بسیار کوتاه پرهیز کن؛ برای سوالات فنی، پاسخ باید مفصل، ساخت‌یافته و در حد یک توضیح تخصصی کامل باشد (معمولاً چند پاراگراف یا چند بند).
موضوعاتی که باید پوشش بدهید: خدمات تعمیرگاه (تعمیر موتور، گیربکس، برق خودرو، جلوبندی، دیاگ و عیب‌یابی، سرویس دوره‌ای)، سوالات عمومی و تخصصی درباره خودرو و نگهداری آن، و راهنمایی درباره نحوه تماس با شاهکار.

نحوه‌ی پاسخ‌دهی به سوالات فنی (این بخش مهم‌ترین قسمت وظیفه‌ی شماست):
- توضیح را با شرح مختصری از عملکرد قطعه یا سیستم مربوطه شروع کن تا کاربر منطق مشکل را بفهمد، نه فقط نتیجه را.
- علائم رایج مرتبط با آن مشکل را فهرست‌وار توضیح بده (مثلاً صدا، لرزش، افت قدرت، افزایش مصرف سوخت، چراغ هشدار و غیره).
- علل احتمالی را از رایج‌ترین به کمترین احتمال، به‌ترتیب و با اصطلاحات فنی درست (اما قابل‌فهم) نام ببر و برای هرکدام یک یا دو جمله توضیح بده.
- در صورت لزوم مراحل عیب‌یابی اولیه یا نکات نگهداری/پیشگیرانه‌ای که خود کاربر می‌تواند بررسی کند را هم ذکر کن.
- در پایان پاسخ‌های فنی، به‌صورت طبیعی (نه تکراری و کلیشه‌ای) کاربر را به مراجعه‌ی حضوری یا تماس با تعمیرگاه شاهکار برای عیب‌یابی دقیق دعوت کن.
- از شماره‌گذاری، تیتر کوتاه یا فهرست برای خوانایی بهتر پاسخ‌های طولانی استفاده کن.

قوانین مهم:
- برای سوالات عمومی و ساده (مثل ساعات کاری، آدرس، نحوه ثبت پیام) می‌توانی مختصرتر و مستقیم جواب بدهی؛ نیازی به تکرار شماره تماس در هر پاسخ نیست.
- قیمت دقیق تعمیرات را اعلام نکن (چون به مدل خودرو و نوع خرابی بستگی دارد)؛ در عوض می‌توانی بازه‌ی کلی عوامل موثر بر قیمت را توضیح دهی و کاربر را به تماس با تعمیرگاه برای اعلام قیمت دقیق ارجاع بده.
- هرگز خودت را به‌عنوان مکانیک یا جایگزین معاینه‌ی حضوری معرفی نکن؛ همیشه روشن کن که تشخیص قطعی نیازمند بازدید حضوری در شاهکار است، اما همین حالا هم توضیح فنی کامل و مفید ارائه بده.
- اگر سوال کاملاً بی‌ربط به خودرو و تعمیرگاه بود، مؤدبانه بگو که فقط می‌توانی درباره‌ی خدمات شاهکار کمک کنی.`;

async function handleChat(request, env) {
  if (!env.AI) {
    return errorResponse(
      "دستیار هوشمند هنوز فعال نشده است. لطفاً مستقیم با شماره 09191389418 تماس بگیرید.",
      503
    );
  }

  const body = await request.json().catch(() => null);
  const message = body && typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return errorResponse("متن پیام الزامی است");
  if (message.length > 1000) return errorResponse("متن پیام خیلی طولانی است");

  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
    .slice(-10)
    .map((h) => ({ role: h.role, content: h.content.slice(0, 1000) }));

  const conversation = history.length ? history : [{ role: "user", content: message }];
  const messages = [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...conversation];

  try {
    // Cloudflare Workers AI — رایگان تا سقف روزانه، بدون نیاز به کلید یا حساب جداگانه
    const aiResult = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages,
      max_tokens: 1200,
    });

    const reply = (aiResult && aiResult.response ? String(aiResult.response) : "").trim();

    if (!reply) {
      return errorResponse("پاسخی دریافت نشد. لطفاً دوباره تلاش کنید.", 502);
    }

    return json({ reply });
  } catch (err) {
    return errorResponse("خطا در ارتباط با دستیار هوشمند. لطفاً دوباره تلاش کنید.", 502);
  }
}

// ---------- ردیابی QR تبلیغاتی (تراکت‌ها) ----------

// هر محدوده (برج ۱، برج ۲ و...) یک کد کوتاه دارد که در آدرس /qr/کد چاپ می‌شود.
// این تابع اسکن را ثبت می‌کند (بدون این‌که مانع هدایت کاربر شود) و بعد او را
// به صفحه مقصدِ همان محدوده هدایت می‌کند.
async function handleQrRedirect(rawCode, request, env) {
  const url = new URL(request.url);
  const fallback = `${url.origin}/`;

  // این تابع تحت هیچ شرایطی نباید خطا نشان بدهد؛ هر اتفاق پیش‌بینی‌نشده‌ای هم بیفتد،
  // کاربر را به صفحه اصلی سایت هدایت می‌کنیم تا QR چاپ‌شده هیچ‌وقت «از کار افتاده» به نظر نرسد
  try {
    const code = decodeURIComponent(rawCode || "").trim();
    if (!code) return Response.redirect(fallback, 302);

    let campaign = null;
    try {
      campaign = await env.DB.prepare("SELECT * FROM qr_campaigns WHERE code = ?").bind(code).first();
    } catch (err) {
      // اگر جدول هنوز ساخته نشده یا دیتابیس مشکل موقتی داشت، حداقل کاربر را به سایت هدایت کن
      return Response.redirect(fallback, 302);
    }
    if (!campaign) return Response.redirect(fallback, 302);

    try {
      const ip = getClientIp(request);
      const ua = getUserAgent(request);
      const visitorHash = await hmacHex(`${ip}|${ua}`, env.ADMIN_PASSWORD || "qr-salt");
      await env.DB.prepare(
        "INSERT INTO qr_scans (campaign_id, visitor_hash, user_agent, scanned_at) VALUES (?, ?, ?, datetime('now'))"
      )
        .bind(campaign.id, visitorHash, ua)
        .run();
    } catch (err) {
      // ثبت آمار نباید مانع هدایت کاربر شود
    }

    const target = String(campaign.target_path || "/").trim();
    const isExternal = /^https?:\/\//i.test(target);
    const destination = isExternal ? target : `${url.origin}${target.startsWith("/") ? target : `/${target}`}`;
    return Response.redirect(destination, 302);
  } catch (err) {
    return Response.redirect(fallback, 302);
  }
}

function randomQrCode() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let code = "q";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) code += chars[bytes[i] % chars.length];
  return code;
}

// برچسب حرفه‌ای سریال: هر دو QR یک محدوده یک شماره مشترک دارند (location_seq که در همان
// ستون serial_number ذخیره می‌شود)، فقط پسوند نوع فرق می‌کند: S برای سایت، M برای مسیریابی
// مثال: SHK-001-S  و  SHK-001-M
function serialLabel(kind, locationSeq) {
  if (!locationSeq) return "—";
  const padded = String(locationSeq).padStart(3, "0");
  const suffix = kind === "routing" ? "M" : "S";
  return `SHK-${padded}-${suffix}`;
}

async function listQrCampaigns(env) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.code, c.title, c.target_path, c.kind, c.serial_number, c.created_at,
       (SELECT COUNT(*) FROM qr_scans s WHERE s.campaign_id = c.id) AS scan_count,
       (SELECT COUNT(DISTINCT visitor_hash) FROM qr_scans s WHERE s.campaign_id = c.id) AS unique_count
     FROM qr_campaigns c
     ORDER BY c.serial_number ASC, c.kind ASC`
  ).all();
  const campaigns = (results || []).map((c) => ({ ...c, serial: serialLabel(c.kind, c.serial_number) }));
  return json({ campaigns });
}

// ساخت یک «محدوده» کامل: همزمان یک QR سایت و یک QR مسیریابی می‌سازد، با یک شماره سریال مشترک
async function createQrLocation(request, env) {
  const body = await request.json().catch(() => null);
  const title = body && typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return errorResponse("عنوان محدوده الزامی است");

  let siteTarget = body && body.target_path ? String(body.target_path).trim() : "/";
  if (!siteTarget.startsWith("/") && !/^https?:\/\//i.test(siteTarget)) siteTarget = `/${siteTarget}`;

  const maxRow = await env.DB.prepare("SELECT MAX(serial_number) AS maxN FROM qr_campaigns").first();
  const seq = (maxRow && maxRow.maxN ? maxRow.maxN : 0) + 1;

  const siteCode = randomQrCode();
  const routingCode = randomQrCode();

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO qr_campaigns (code, title, target_path, kind, serial_number, created_at) VALUES (?, ?, ?, 'site', ?, datetime('now'))"
    ).bind(siteCode, title, siteTarget, seq),
    env.DB.prepare(
      "INSERT INTO qr_campaigns (code, title, target_path, kind, serial_number, created_at) VALUES (?, ?, ?, 'routing', ?, datetime('now'))"
    ).bind(routingCode, title, "/route.html", seq),
  ]);

  return json(
    {
      location_seq: seq,
      title,
      site: { code: siteCode, serial: serialLabel("site", seq) },
      routing: { code: routingCode, serial: serialLabel("routing", seq) },
    },
    201
  );
}

// ویرایش یک محدوده: عنوان روی هر دو QR اعمال می‌شود، مقصد فقط روی QR سایت (مقصد مسیریابی ثابت است)
async function updateQrLocation(seq, request, env) {
  const exists = await env.DB.prepare("SELECT id FROM qr_campaigns WHERE serial_number = ?").bind(seq).first();
  if (!exists) return errorResponse("محدوده یافت نشد", 404);

  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("داده نامعتبر است");

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  let siteTarget = typeof body.target_path === "string" && body.target_path.trim() ? body.target_path.trim() : null;
  if (siteTarget && !siteTarget.startsWith("/") && !/^https?:\/\//i.test(siteTarget)) siteTarget = `/${siteTarget}`;

  await env.DB.batch([
    env.DB.prepare("UPDATE qr_campaigns SET title = COALESCE(?, title) WHERE serial_number = ?").bind(title, seq),
    env.DB.prepare("UPDATE qr_campaigns SET target_path = COALESCE(?, target_path) WHERE serial_number = ? AND kind = 'site'").bind(
      siteTarget,
      seq
    ),
  ]);

  return json({ ok: true });
}

// حذف یک محدوده: هر دو QR (سایت و مسیریابی) و آمار اسکن‌هایشان با هم حذف می‌شوند
async function deleteQrLocation(seq, env) {
  const { results } = await env.DB.prepare("SELECT id FROM qr_campaigns WHERE serial_number = ?").bind(seq).all();
  if (!results || !results.length) return errorResponse("محدوده یافت نشد", 404);

  const stmts = results.map((row) => env.DB.prepare("DELETE FROM qr_scans WHERE campaign_id = ?").bind(row.id));
  stmts.push(env.DB.prepare("DELETE FROM qr_campaigns WHERE serial_number = ?").bind(seq));
  await env.DB.batch(stmts);

  return json({ ok: true });
}

// ---------- روتر اصلی ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // اسکن QR تراکت‌ها: قبل از هر بررسی دیگری، چون مسیر عمومی و بدون /api/ است
    if (path.startsWith("/qr/")) {
      return handleQrRedirect(path.slice(4), request, env);
    }

    // صفحات پنل مدیریت: نیاز به نشست ورود معتبر دارند، وگرنه به صفحه‌ی ورود اختصاصی هدایت می‌شوند
    if (path === "/panel-admin.html" || path === "/panel-customers.html" || path === "/panel-customer.html" || path === "/panel-blog.html" || path === "/panel-qr.html") {
      if (!(await isAuthorized(request, env))) {
        const nextParam = encodeURIComponent(path + url.search);
        return Response.redirect(`${url.origin}/panel-login.html?next=${nextParam}`, 302);
      }
      return env.ASSETS.fetch(request);
    }

    if (!path.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
    }

    // مسیرهایی که فقط مدیر (با رمز عبور) اجازه دارد
    const isPublicRead = path.match(/^\/api\/customers\/[^/]+$/) && method === "GET";
    const isPublicContact = path === "/api/contact" && method === "POST";
    const isPublicReviews = path === "/api/reviews" && (method === "GET" || method === "POST");
    const isPublicChat = path === "/api/chat" && method === "POST";
    // مقالات وبلاگ: لیست عمومی و خواندن تک مقاله با اسلاگ (غیر عددی) برای هر بازدیدکننده آزاد است؛
    // لیست کامل مدیریتی (/api/articles/admin) و ساخت/ویرایش/حذف فقط با رمز عبور مدیر
    const isPublicArticlesList = path === "/api/articles" && method === "GET";
    const articleSlugMatch = path.match(/^\/api\/articles\/([^/]+)$/);
    const isPublicArticleBySlug =
      !!articleSlugMatch && method === "GET" && !/^\d+$/.test(articleSlugMatch[1]) && articleSlugMatch[1] !== "admin";
    const isPublicAdminAuth = path === "/api/admin/login" || path === "/api/admin/logout";
    const isPublicTrack = path === "/api/track" && method === "POST";
    if (!isPublicRead && !isPublicContact && !isPublicReviews && !isPublicChat && !isPublicArticlesList && !isPublicArticleBySlug && !isPublicAdminAuth && !isPublicTrack) {
      if (!(await isAuthorized(request, env))) return unauthorizedApiResponse();
    }

    let m;

    if (path === "/api/customers" && method === "GET") return listCustomers(env);
    if (path === "/api/customers" && method === "POST") return createCustomer(request, env);

    if ((m = path.match(/^\/api\/customers\/([^/]+)$/))) {
      if (method === "GET") return getCustomer(decodeURIComponent(m[1]), env);
      if (method === "PUT") return updateCustomer(decodeURIComponent(m[1]), request, env);
      if (method === "DELETE") return deleteCustomer(decodeURIComponent(m[1]), env);
    }

    if (path === "/api/cars" && method === "POST") return addCar(request, env);
    if ((m = path.match(/^\/api\/cars\/(\d+)$/))) {
      if (method === "PUT") return updateCar(m[1], request, env);
      if (method === "DELETE") return deleteCar(m[1], env);
    }

    if (path === "/api/visits" && method === "POST") return addVisit(request, env);
    if ((m = path.match(/^\/api\/visits\/(\d+)$/))) {
      if (method === "PUT") return updateVisit(m[1], request, env);
      if (method === "DELETE") return deleteVisit(m[1], env);
    }

    if (path === "/api/parts" && method === "POST") return addPart(request, env);
    if ((m = path.match(/^\/api\/parts\/(\d+)$/))) {
      if (method === "PUT") return updatePart(m[1], request, env);
      if (method === "DELETE") return deletePart(m[1], env);
    }

    if (path === "/api/contact" && method === "POST") return createMessage(request, env);
    if (path === "/api/contact" && method === "GET") return listMessages(env);
    if ((m = path.match(/^\/api\/contact\/(\d+)$/))) {
      if (method === "PUT") return markMessageRead(m[1], env);
      if (method === "DELETE") return deleteMessage(m[1], env);
    }

    if (path === "/api/reviews" && method === "POST") return createReview(request, env);
    if (path === "/api/reviews" && method === "GET") return listReviewsPublic(env);
    if (path === "/api/reviews/admin" && method === "GET") return listReviewsAdmin(env);
    if ((m = path.match(/^\/api\/reviews\/(\d+)$/))) {
      if (method === "DELETE") return deleteReview(m[1], env);
    }

    if (path === "/api/articles" && method === "GET") return listArticlesPublic(env);
    if (path === "/api/articles" && method === "POST") return createArticle(request, env);
    if (path === "/api/articles/admin" && method === "GET") return listArticlesAdmin(env);

    if ((m = path.match(/^\/api\/articles\/(\d+)$/))) {
      if (method === "GET") return getArticleById(m[1], env);
      if (method === "PUT") return updateArticle(m[1], request, env);
      if (method === "DELETE") return deleteArticle(m[1], env);
    }

    if ((m = path.match(/^\/api\/articles\/([^/]+)$/))) {
      if (method === "GET") return getArticleBySlug(decodeURIComponent(m[1]), env);
    }

    if (path === "/api/chat" && method === "POST") return handleChat(request, env);

    if (path === "/api/admin/login" && method === "POST") return handleAdminLogin(request, env);
    if (path === "/api/admin/logout" && method === "POST") return handleAdminLogout();
    if (path === "/api/admin/security" && method === "GET") return handleAdminSecurityInfo(env);
    if (path === "/api/track" && method === "POST") return handleTrackPageView(request, env);
    if (path === "/api/admin/analytics" && method === "GET") return handleAdminAnalytics(env);

    if (path === "/api/qr" && method === "GET") return listQrCampaigns(env);
    if (path === "/api/qr-locations" && method === "POST") return createQrLocation(request, env);
    if ((m = path.match(/^\/api\/qr-locations\/(\d+)$/))) {
      if (method === "PUT") return updateQrLocation(Number(m[1]), request, env);
      if (method === "DELETE") return deleteQrLocation(Number(m[1]), env);
    }

    return errorResponse("مسیر یافت نشد", 404);
  },
};
