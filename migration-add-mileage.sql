-- =====================================================
-- مهاجرت: افزودن فیلدهای کارکرد (کیلومتر) و حذف کامل منطق قدیمی موعد بر اساس تاریخ
-- این فایل را در تب Console دیتابیس shamkar-db روی Cloudflare Dashboard اجرا کن
-- (نه schema.sql کامل، چون آن فایل جدول‌ها را DROP می‌کند و داده‌های فعلی را پاک می‌کند).
--
-- اگر قبلاً یک‌بار خط‌های ALTER TABLE مربوط به replaced_at_mileage و
-- next_due_mileage را اجرا کرده‌ای، همان دو خط را دوباره اجرا نکن (چون ستون
-- تکراری خطا می‌دهد)؛ فقط بخش «current_mileage» و حذف «next_due_date» را اجرا کن.
-- =====================================================

-- ۱) اگر هنوز این دو ستون را نساخته‌ای (نصب اول):
ALTER TABLE parts_replaced ADD COLUMN replaced_at_mileage INTEGER;
ALTER TABLE parts_replaced ADD COLUMN next_due_mileage INTEGER;

-- ۲) کارکرد فعلی هر خودرو (برای محاسبه موعد بر اساس کیلومتر لازم است)
ALTER TABLE cars ADD COLUMN current_mileage INTEGER;

-- ۳) موعد تاریخی حذف شده؛ از این پس فقط next_due_mileage ملاک است.
--    توجه: DROP COLUMN فقط روی نسخه‌های جدید SQLite/D1 کار می‌کند. اگر
--    Cloudflare D1 ارور داد، همین خط را نادیده بگیر — وجود ستون خالی
--    next_due_date مشکلی ایجاد نمی‌کند چون کد جدید دیگر از آن استفاده نمی‌کند.
ALTER TABLE parts_replaced DROP COLUMN next_due_date;

DROP INDEX IF EXISTS idx_parts_due;
CREATE INDEX IF NOT EXISTS idx_parts_next_mileage ON parts_replaced(next_due_mileage);
