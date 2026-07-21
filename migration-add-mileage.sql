-- =====================================================
-- مهاجرت: افزودن فیلدهای کارکرد (کیلومتر) به قطعات تعویض‌شده
-- این فایل را فقط یک‌بار، در تب Console دیتابیس shamkar-db
-- روی Cloudflare Dashboard اجرا کن (نه schema.sql کامل، چون آن
-- فایل جدول‌ها را DROP می‌کند و داده‌های فعلی را پاک می‌کند).
-- =====================================================

ALTER TABLE parts_replaced ADD COLUMN replaced_at_mileage INTEGER;
ALTER TABLE parts_replaced ADD COLUMN next_due_mileage INTEGER;
