-- =====================================================
-- شماکار | پایگاه‌داده پنل مشتریان و سوابق سرویس خودرو
-- برای اجرا روی Cloudflare D1
-- =====================================================

DROP TABLE IF EXISTS parts_replaced;
DROP TABLE IF EXISTS visits;
DROP TABLE IF EXISTS cars;
DROP TABLE IF EXISTS customers;

-- مشتری‌ها
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,          -- کد یکتای غیرقابل‌حدس برای لینک صفحه اختصاصی
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- خودروهای هر مشتری (هر مشتری می‌تواند چند خودرو داشته باشد)
CREATE TABLE cars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  plate TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- مراجعات (هر بار مراجعه مشتری برای یک خودرو، یک رکورد)
CREATE TABLE visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  visit_date TEXT NOT NULL,           -- تاریخ مراجعه فعلی (شمسی، ذخیره به‌صورت رشته YYYY-MM-DD)
  complaints TEXT,                    -- ایرادات اعلام‌شده توسط مشتری
  resolved TEXT,                      -- ایرادات رفع‌شده
  notes TEXT,                         -- یادداشت آزاد
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- قطعات تعویض‌شده در هر مراجعه (هر قطعه موعد بعدی جداگانه دارد)
CREATE TABLE parts_replaced (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  next_due_date TEXT,                 -- تاریخ موعد تعویض بعدی این قطعه
  notes TEXT
);

CREATE INDEX idx_cars_customer ON cars(customer_id);
CREATE INDEX idx_visits_car ON visits(car_id);
CREATE INDEX idx_parts_visit ON parts_replaced(visit_id);
CREATE INDEX idx_parts_due ON parts_replaced(next_due_date);
CREATE INDEX idx_customers_code ON customers(code);
