-- =====================================================
-- شماکار | مهاجرت: افزودن قابلیت‌های امنیتی پنل مدیریت
-- (یوزرنیم مدیر، ثبت زمان ورود، تشخیص ورود مشکوک)
-- این فایل را در تب Console دیتابیس shamkar-db روی
-- Cloudflare Dashboard اجرا کن (نه schema.sql، چون آن فایل
-- همه‌ی جدول‌ها را پاک می‌کند)
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_logins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  success INTEGER NOT NULL DEFAULT 1,       -- ۰ یعنی تلاش ناموفق (رمز/یوزرنیم اشتباه)
  is_suspicious INTEGER NOT NULL DEFAULT 0, -- ۱ یعنی این ورود از آدرس اینترنتی متفاوت نسبت به ورود موفق قبلی بوده
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_logins_created ON admin_logins(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_logins_username ON admin_logins(username);
