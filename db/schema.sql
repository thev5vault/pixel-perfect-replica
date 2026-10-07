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
  workshop_type TEXT NOT NULL DEFAULT 'garage' CHECK (workshop_type IN ('garage','specialist')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_sample BOOLEAN NOT NULL DEFAULT false
  ,dev_role TEXT
);
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS workshop_type TEXT NOT NULL DEFAULT 'garage' CHECK (workshop_type IN ('garage','specialist'));
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

-- Application schema changes are applied to development, then through Publish;
-- never run this application DDL during production startup.
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS vat_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS vat_verified_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS keeper_changed_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS public_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ownership_claims ADD COLUMN IF NOT EXISTS vin TEXT;
ALTER TABLE ownership_claims ADD COLUMN IF NOT EXISTS review_reason TEXT;
ALTER TABLE ownership_claims ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES user_accounts(id);
ALTER TABLE ownership_claims ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;
ALTER TABLE modifications ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;
ALTER TABLE modifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS vehicle_transfers (
  id TEXT PRIMARY KEY, vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  previous_keeper_id TEXT REFERENCES user_accounts(id), new_keeper_id TEXT NOT NULL REFERENCES user_accounts(id),
  approved_by TEXT NOT NULL REFERENCES user_accounts(id), transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  history_snapshot JSONB NOT NULL, is_sample BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS vehicle_transfers_previous_keeper_idx ON vehicle_transfers(previous_keeper_id,vehicle_id);
CREATE TABLE IF NOT EXISTS sales_pack_orders (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user_accounts(id),
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id), stripe_checkout_session_id TEXT UNIQUE,
  snapshot JSONB NOT NULL, fulfilled_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reminder_preferences (
  user_id TEXT PRIMARY KEY REFERENCES user_accounts(id), email BOOLEAN NOT NULL DEFAULT false,
  sms BOOLEAN NOT NULL DEFAULT false, phone TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reminder_deliveries (
  id TEXT PRIMARY KEY, garage_user_id TEXT NOT NULL REFERENCES user_accounts(id),
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id), recipient_user_id TEXT NOT NULL REFERENCES user_accounts(id),
  kind TEXT NOT NULL CHECK(kind IN ('mot','service')), due_date DATE NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('email','sms')), provider_message_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('sending','queued','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(garage_user_id,vehicle_id,kind,due_date,channel)
);
CREATE OR REPLACE FUNCTION protect_vault_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='vehicle_transfers' THEN
    RAISE EXCEPTION 'Keeper transfer history is immutable';
  END IF;
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Vehicle history cannot be deleted';
  END IF;
  IF OLD.frozen_at IS NOT NULL THEN
    RAISE EXCEPTION 'History recorded before a keeper transfer is immutable';
  END IF;
  IF TG_TABLE_NAME='service_records' AND
     (to_jsonb(NEW)-'frozen_at') IS DISTINCT FROM (to_jsonb(OLD)-'frozen_at') THEN
    RAISE EXCEPTION 'Service records are append-only';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS immutable_service_history ON service_records;
CREATE TRIGGER immutable_service_history BEFORE UPDATE OR DELETE ON service_records FOR EACH ROW EXECUTE FUNCTION protect_vault_history();
DROP TRIGGER IF EXISTS immutable_modification_history ON modifications;
CREATE TRIGGER immutable_modification_history BEFORE UPDATE OR DELETE ON modifications FOR EACH ROW EXECUTE FUNCTION protect_vault_history();
DROP TRIGGER IF EXISTS immutable_keeper_history ON vehicle_transfers;
CREATE TRIGGER immutable_keeper_history BEFORE UPDATE OR DELETE ON vehicle_transfers FOR EACH ROW EXECUTE FUNCTION protect_vault_history();
