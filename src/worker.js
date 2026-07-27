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

// ---------- بررسی رمز عبور مدیر (Basic Auth) ----------
function isAuthorized(request, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return false;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  const decoded = atob(authHeader.slice(6));
  const sep = decoded.indexOf(":");
  const password = sep >= 0 ? decoded.slice(sep + 1) : "";
  return password === expected;
}

function unauthorizedResponse(hasPasswordConfigured) {
  if (!hasPasswordConfigured) {
    return new Response(
      "دسترسی به پنل مدیریت پیکربندی نشده است. متغیر ADMIN_PASSWORD را در Settings پروژه Worker تعریف کنید.",
      { status: 503 }
    );
  }
  return new Response("برای ورود به پنل مدیریت، رمز عبور لازم است.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="پنل مدیریت شاهکار"' },
  });
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

const CHAT_SYSTEM_PROMPT = `شما دستیار هوشمند سایت «تعمیرگاه تخصصی شاهکار» هستید.
وظیفه شما پاسخ‌گویی دقیق و کوتاه (حداکثر چند جمله) به فارسی محاوره‌ای مؤدبانه است.
موضوعاتی که باید پوشش بدهید: خدمات تعمیرگاه (تعمیر موتور، گیربکس، برق خودرو، جلوبندی، دیاگ و عیب‌یابی، سرویس دوره‌ای)، سوالات عمومی درباره خودرو و نگهداری آن، و راهنمایی درباره نحوه تماس با شاهکار.
قوانین مهم:
- اگر کاربر مشکل فنی یا خرابی واقعی خودرو را توضیح داد، راهنمایی کلی و مفید بده و در پایان پیشنهاد بده برای تعمیر و عیب‌یابی دقیق به تعمیرگاه شاهکار مراجعه کند یا با شماره 09191389418 تماس بگیرد.
- برای سوالات عمومی و ساده (مثل ساعات کاری، آدرس، نحوه ثبت پیام) مستقیم و کوتاه جواب بده، نیازی به تکرار شماره تماس در هر پاسخ نیست.
- قیمت دقیق تعمیرات را اعلام نکن (چون به مدل خودرو و نوع خرابی بستگی دارد)؛ کاربر را به تماس با تعمیرگاه برای اعلام قیمت دقیق ارجاع بده.
- هرگز خودت را به‌عنوان مکانیک یا جایگزین معاینه‌ی حضوری معرفی نکن؛ همیشه روشن کن که تشخیص قطعی نیازمند بازدید حضوری در شاهکار است.
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
      max_tokens: 400,
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

// ---------- روتر اصلی ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // صفحات پنل مدیریت: نیاز به رمز عبور دارند، بعد فایل استاتیک اصلی سرو می‌شود
    if (path === "/panel-admin.html" || path === "/panel-customer.html" || path === "/panel-blog.html") {
      if (!isAuthorized(request, env)) return unauthorizedResponse(!!env.ADMIN_PASSWORD);
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
    if (!isPublicRead && !isPublicContact && !isPublicReviews && !isPublicChat && !isPublicArticlesList && !isPublicArticleBySlug) {
      if (!isAuthorized(request, env)) return unauthorizedResponse(!!env.ADMIN_PASSWORD);
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

    return errorResponse("مسیر یافت نشد", 404);
  },
};
