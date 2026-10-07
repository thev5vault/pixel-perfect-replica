CREATE TABLE IF NOT EXISTS user_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT, -- Deliberately NULL: credentials and password hashes are managed by Clerk.
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'civilian' CHECK (role IN ('civilian','modder','verified_garage')),
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','pro_diy','pro_modder','verified_garage')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  garage_verified BOOLEAN NOT NULL DEFAULT false,
  garage_name TEXT NOT NULL DEFAULT '',
  garage_registration TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_sample BOOLEAN NOT NULL DEFAULT false
  ,dev_role TEXT
);
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES user_accounts(id),
  v5c_reference_hash TEXT,
  data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_sample BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS ownership_claims (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  user_id TEXT NOT NULL REFERENCES user_accounts(id),
  reference_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS service_records (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  created_by_user_id TEXT REFERENCES user_accounts(id),
  data JSONB NOT NULL,
  is_verified_stamp BOOLEAN NOT NULL DEFAULT false,
  stamped_by_garage_id TEXT REFERENCES user_accounts(id),
  stamp_signature TEXT,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS modifications (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS account_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_accounts(id),
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workshop_bookings (
  id TEXT PRIMARY KEY,
  garage_user_id TEXT NOT NULL REFERENCES user_accounts(id),
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  scheduled_date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','completed','cancelled'))
);
CREATE INDEX IF NOT EXISTS vehicles_owner_idx ON vehicles(owner_user_id);
CREATE INDEX IF NOT EXISTS service_records_vehicle_idx ON service_records(vehicle_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON account_notifications(user_id);
CREATE TABLE IF NOT EXISTS vehicle_reference_uses (
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  reference_hash TEXT NOT NULL,
  PRIMARY KEY(vehicle_id,reference_hash),
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Preserve all past approvals, not merely the vehicle's most recent reference.
INSERT INTO vehicle_reference_uses(vehicle_id,reference_hash)
  SELECT DISTINCT vehicle_id,reference_hash FROM ownership_claims WHERE status='approved'
  ON CONFLICT DO NOTHING;
INSERT INTO vehicle_reference_uses(vehicle_id,reference_hash)
  SELECT id,v5c_reference_hash FROM vehicles WHERE v5c_reference_hash IS NOT NULL
  ON CONFLICT DO NOTHING;
