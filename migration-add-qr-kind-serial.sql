-- =====================================================
-- مهاجرت: افزودن «نوع QR» (سایت / مسیریابی) و «سریال خودکار» به محدوده‌های QR
-- این فایل را بعد از migration-add-qr-tracking.sql و در همان Console دیتابیس
-- shamkar-db اجرا کن. اگر قبلاً محدوده تستی ساخته بودی، بعد از این مهاجرت
-- بهتر است پاکش کنی و از پنل دوباره بسازی تا نوع و سریال درست داشته باشد.
-- =====================================================

-- kind: نوع QR — 'site' یعنی به صفحه‌ای از سایت می‌رود، 'routing' یعنی به
-- لینک نقشه (گوگل‌مپ/نشان) برای رسیدن فیزیکی به ساختمان می‌رود
ALTER TABLE qr_campaigns ADD COLUMN kind TEXT NOT NULL DEFAULT 'site';

-- serial_number: عدد افزایشی جدا برای هر نوع (سایت از ۱، مسیریابی هم از ۱ شروع می‌شود)
-- برچسب نمایشی سریال (مثلاً S1 یا M1) از روی kind + serial_number ساخته می‌شود
ALTER TABLE qr_campaigns ADD COLUMN serial_number INTEGER;

CREATE INDEX IF NOT EXISTS idx_qr_campaigns_kind_serial ON qr_campaigns(kind, serial_number);
