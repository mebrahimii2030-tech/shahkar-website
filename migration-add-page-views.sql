-- =====================================================
-- شماکار | مهاجرت: افزودن آمار بازدید سایت و پنل مدیریت
-- این فایل را در تب Console دیتابیس shamkar-db روی
-- Cloudflare Dashboard اجرا کن (نه schema.sql، چون آن فایل
-- همه‌ی جدول‌ها را پاک می‌کند)
-- =====================================================

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  referrer TEXT,
  ip TEXT,
  user_agent TEXT,
  is_panel INTEGER NOT NULL DEFAULT 0, -- ۱ یعنی بازدید یکی از صفحات پنل مدیریت (panel-*.html)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_panel ON page_views(is_panel);
