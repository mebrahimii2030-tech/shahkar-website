-- =====================================================
-- مهاجرت: افزودن سیستم ردیابی QR تبلیغاتی (تراکت‌ها)
-- این فایل را در تب Console دیتابیس shamkar-db روی Cloudflare Dashboard اجرا کن
-- (نه schema.sql کامل، چون آن فایل جدول‌ها را DROP می‌کند و داده‌های فعلی را پاک می‌کند).
-- =====================================================

-- هر ردیف یک «محدوده تبلیغاتی» است، مثلاً برج ۱، برج ۲، اطراف شهرک و ...
-- code: بخشی از آدرس QR که چاپ می‌شود، مثلاً T01 در آدرس /qr/T01
-- target_path: مسیری از سایت که کاربر بعد از اسکن به آن هدایت می‌شود، مثلاً /index.html
CREATE TABLE IF NOT EXISTS qr_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  target_path TEXT NOT NULL DEFAULT '/',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- هر ردیف یک بار اسکن‌شدن یکی از QR هاست
-- visitor_hash: هش IP+مرورگر (نه خود IP خام) که فقط برای شمارش «کاربر یکتا» استفاده می‌شود
CREATE TABLE IF NOT EXISTS qr_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES qr_campaigns(id),
  visitor_hash TEXT,
  user_agent TEXT,
  scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_campaign ON qr_scans(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_date ON qr_scans(scanned_at);
