// این میان‌افزار، پنل مدیریت و تمام API های ویرایشی را با رمز عبور محافظت می‌کند.
// صفحه اختصاصی هر مشتری (customer.html) و GET /api/customers/:code عمداً باز می‌مانند
// چون مشتری‌ها بدون لاگین باید بتوانند با لینک اختصاصی خودشان صفحه‌شان را ببینند.

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const isProtectedPage = path === "/panel-admin.html" || path === "/panel-customer.html";
  const isProtectedApi =
    path.startsWith("/api/cars") ||
    path.startsWith("/api/visits") ||
    path.startsWith("/api/parts") ||
    path === "/api/customers" || // لیست همه مشتری‌ها و ثبت مشتری جدید
    (path.startsWith("/api/customers/") && request.method !== "GET"); // ویرایش مشتری

  if (!isProtectedPage && !isProtectedApi) {
    return next();
  }

  const expected = env.ADMIN_PASSWORD;
  if (!expected) {
    return new Response(
      "دسترسی به پنل مدیریت هنوز پیکربندی نشده است. متغیر ADMIN_PASSWORD را در تنظیمات Cloudflare Pages تعریف کنید.",
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice(6));
    const separatorIndex = decoded.indexOf(":");
    const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";
    if (password === expected) {
      return next();
    }
  }

  return new Response("برای ورود به پنل مدیریت، رمز عبور لازم است.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="پنل مدیریت شاهکار"' },
  });
}
