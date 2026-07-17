CREATE TABLE IF NOT EXISTS orders (
  razorpay_order_id TEXT PRIMARY KEY,
  receipt TEXT,
  created_at TEXT NOT NULL,
  amount_paid REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_status TEXT NOT NULL DEFAULT 'created',
  payment_method TEXT,
  payment_id TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_mobile TEXT NOT NULL,
  customer_pincode TEXT,
  customer_address TEXT,
  items_text TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  fulfillment_status TEXT NOT NULL DEFAULT 'New',
  status_updated_at TEXT,
  paid_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_mobile_created
ON orders(customer_mobile, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
ON orders(payment_status);

CREATE TABLE IF NOT EXISTS otp_sessions (
  mobile TEXT PRIMARY KEY,
  provider_session_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  sent_at INTEGER NOT NULL,
  verify_attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS custom_uploads (
  id TEXT PRIMARY KEY,
  image_url TEXT NOT NULL,
  public_id TEXT,
  created_at TEXT NOT NULL
);
