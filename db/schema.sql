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
  vin TEXT PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  vrm TEXT NOT NULL UNIQUE,
  owner_user_id TEXT REFERENCES user_accounts(id),
  v5c_reference_hash TEXT,
  data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_sample BOOLEAN NOT NULL DEFAULT false,
  verification_tier TEXT NOT NULL DEFAULT 'provisional' CHECK (verification_tier IN ('provisional','workshop_checked','government_data')),
  is_scrapped BOOLEAN NOT NULL DEFAULT false,
  scrapped_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS ownership_claims (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  user_id TEXT NOT NULL REFERENCES user_accounts(id),
  vin TEXT REFERENCES vehicles(vin),
  reference_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS service_attachments (
  service_record_id TEXT NOT NULL REFERENCES service_records(id),
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('receipt','invoice')),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
  filename TEXT NOT NULL DEFAULT 'receipt.jpg',
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_record_id,attachment_type)
);
CREATE TABLE IF NOT EXISTS service_records (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  vin TEXT NOT NULL REFERENCES vehicles(vin),
  physically_inspected_vin BOOLEAN NOT NULL DEFAULT false,
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
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vrm TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS keeper_changed_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS public_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS verification_tier TEXT NOT NULL DEFAULT 'provisional';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_scrapped BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS scrapped_at TIMESTAMPTZ;
ALTER TABLE ownership_claims ADD COLUMN IF NOT EXISTS vin TEXT;
ALTER TABLE ownership_claims ADD COLUMN IF NOT EXISTS review_reason TEXT;
ALTER TABLE ownership_claims ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES user_accounts(id);
ALTER TABLE ownership_claims ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS vin TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS physically_inspected_vin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS stamped_by_user_id TEXT REFERENCES user_accounts(id);
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS stamped_at TIMESTAMPTZ;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS mileage INTEGER;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS components JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS work_performed TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS advisories TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS parts JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS parts_cost NUMERIC(12,2);
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS labour_cost NUMERIC(12,2);
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'GBP';
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS invoice_url TEXT;
CREATE TABLE IF NOT EXISTS service_attachments (
  service_record_id TEXT NOT NULL REFERENCES service_records(id),
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('receipt','invoice')),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
  filename TEXT NOT NULL DEFAULT 'receipt.jpg',
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_record_id,attachment_type)
);
UPDATE ownership_claims c SET vin=v.vin
  FROM vehicles v WHERE c.vehicle_id=v.id AND c.vin IS NULL;
ALTER TABLE ownership_claims ALTER COLUMN vin SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE ownership_claims ADD CONSTRAINT ownership_claims_vin_fkey
    FOREIGN KEY (vin) REFERENCES vehicles(vin) ON UPDATE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE vehicles ADD CONSTRAINT vehicles_verification_tier_check
    CHECK (verification_tier IN ('provisional','workshop_checked','government_data'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS service_attachments_record_idx ON service_attachments(service_record_id);
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

-- Vehicle identity can never be rebound to another keeper after its first claim.
CREATE OR REPLACE FUNCTION prevent_active_keeper_overwrite() RETURNS trigger AS $$
BEGIN
  IF OLD.owner_user_id IS NOT NULL AND NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Vehicle already registered to an active keeper.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS immutable_vehicle_keeper ON vehicles;
CREATE TRIGGER immutable_vehicle_keeper BEFORE UPDATE OF owner_user_id ON vehicles
  FOR EACH ROW EXECUTE FUNCTION prevent_active_keeper_overwrite();
DROP TRIGGER IF EXISTS immutable_modification_history ON modifications;
CREATE TRIGGER immutable_modification_history BEFORE UPDATE OR DELETE ON modifications FOR EACH ROW EXECUTE FUNCTION protect_vault_history();
DROP TRIGGER IF EXISTS immutable_keeper_history ON vehicle_transfers;
CREATE TRIGGER immutable_keeper_history BEFORE UPDATE OR DELETE ON vehicle_transfers FOR EACH ROW EXECUTE FUNCTION protect_vault_history();

-- VIN is the canonical vehicle identity. The historical id remains a stable,
-- unique compatibility key for existing history-table references; VRM is a
-- separate unique, editable registration field.
UPDATE vehicles
SET vrm = COALESCE(NULLIF(vrm, ''), NULLIF(data->>'vrm', ''), id)
WHERE vrm IS NULL OR vrm = '';
UPDATE vehicles
SET vin = COALESCE(
  NULLIF(upper(vin), ''),
  NULLIF(upper(data->>'vin'), ''),
  CASE
    WHEN is_sample AND (id = 'AB14CDE' OR upper(data->>'vrm') = 'AB14CDE') THEN 'WAUZZZ8K9EA000001'
    WHEN is_sample AND (id = 'BUL200' OR upper(data->>'vrm') = 'BUL200') THEN 'WVWZZZ1KZJW000001'
    ELSE NULL
  END
)
WHERE vin IS NULL OR vin = '';

DO $$
DECLARE missing_count integer;
DECLARE invalid_count integer;
DECLARE duplicate_count integer;
BEGIN
  SELECT count(*) INTO missing_count FROM vehicles WHERE vin IS NULL OR vin = '';
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'VIN migration stopped: % vehicle(s) have no VIN. Add verified VINs before applying this schema.', missing_count;
  END IF;
  SELECT count(*) INTO invalid_count FROM vehicles WHERE vin !~ '^[A-HJ-NPR-Z0-9]{17}$';
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'VIN migration stopped: % vehicle(s) have an invalid VIN. VINs must be 17 characters and exclude I, O and Q.', invalid_count;
  END IF;
  SELECT count(*) INTO duplicate_count FROM (SELECT vin FROM vehicles GROUP BY vin HAVING count(*) > 1) duplicates;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'VIN migration stopped: duplicate VINs must be resolved before changing vehicle identity.';
  END IF;
END $$;

UPDATE vehicles
SET data = jsonb_set(
  jsonb_set(COALESCE(data, '{}'::jsonb), '{vin}', to_jsonb(vin), true),
  '{vrm}', to_jsonb(vrm), true
);

DROP TRIGGER IF EXISTS immutable_service_history ON service_records;
UPDATE service_records s
SET vin = v.vin
FROM vehicles v
WHERE s.vehicle_id = v.id AND (s.vin IS NULL OR s.vin = '');

DO $$
DECLARE missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count FROM service_records WHERE vin IS NULL OR vin = '';
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Service VIN migration stopped: % service record(s) could not be matched to a vehicle.', missing_count;
  END IF;
END $$;

ALTER TABLE vehicles ALTER COLUMN id SET NOT NULL;
ALTER TABLE vehicles ALTER COLUMN vin SET NOT NULL;
ALTER TABLE vehicles ALTER COLUMN vrm SET NOT NULL;
ALTER TABLE service_records ALTER COLUMN vin SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_id_vin_unique_idx ON vehicles(id, vin);
DO $$
DECLARE vrm_attnum smallint;
DECLARE has_vrm_unique_constraint boolean;
BEGIN
  SELECT attnum INTO vrm_attnum FROM pg_attribute WHERE attrelid='vehicles'::regclass AND attname='vrm' AND NOT attisdropped;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='vehicles'::regclass AND contype='u'
      AND conkey=ARRAY[vrm_attnum]::smallint[]
  ) INTO has_vrm_unique_constraint;
  IF NOT has_vrm_unique_constraint THEN
    CREATE UNIQUE INDEX vehicles_vrm_unique_idx ON vehicles(vrm);
  END IF;
END $$;

-- Existing history tables retain their stable vehicle_id references. Rebind
-- those references to the compatibility unique key before replacing the PK.
ALTER TABLE ownership_claims DROP CONSTRAINT IF EXISTS ownership_claims_vehicle_id_fkey;
ALTER TABLE service_records DROP CONSTRAINT IF EXISTS service_records_vehicle_id_fkey;
ALTER TABLE modifications DROP CONSTRAINT IF EXISTS modifications_vehicle_id_fkey;
ALTER TABLE workshop_bookings DROP CONSTRAINT IF EXISTS workshop_bookings_vehicle_id_fkey;
ALTER TABLE vehicle_reference_uses DROP CONSTRAINT IF EXISTS vehicle_reference_uses_vehicle_id_fkey;
ALTER TABLE vehicle_transfers DROP CONSTRAINT IF EXISTS vehicle_transfers_vehicle_id_fkey;
ALTER TABLE sales_pack_orders DROP CONSTRAINT IF EXISTS sales_pack_orders_vehicle_id_fkey;
ALTER TABLE reminder_deliveries DROP CONSTRAINT IF EXISTS reminder_deliveries_vehicle_id_fkey;

DO $$
DECLARE id_attnum smallint;
DECLARE vin_attnum smallint;
DECLARE primary_name text;
DECLARE has_id_unique_constraint boolean;
BEGIN
  SELECT attnum INTO id_attnum FROM pg_attribute WHERE attrelid='vehicles'::regclass AND attname='id' AND NOT attisdropped;
  SELECT attnum INTO vin_attnum FROM pg_attribute WHERE attrelid='vehicles'::regclass AND attname='vin' AND NOT attisdropped;
  SELECT conname INTO primary_name FROM pg_constraint
    WHERE conrelid='vehicles'::regclass AND contype='p';
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='vehicles'::regclass AND contype='u'
      AND conkey=ARRAY[id_attnum]::smallint[]
  ) INTO has_id_unique_constraint;
  IF NOT has_id_unique_constraint THEN
    CREATE UNIQUE INDEX vehicles_id_legacy_unique_idx ON vehicles(id);
  END IF;
  IF primary_name IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='vehicles'::regclass AND contype='p' AND conkey=ARRAY[vin_attnum]::smallint[]
  ) THEN
    EXECUTE format('ALTER TABLE vehicles DROP CONSTRAINT %I', primary_name);
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_pkey PRIMARY KEY (vin);
  ELSIF primary_name IS NULL THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_pkey PRIMARY KEY (vin);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='vehicles'::regclass AND conname='vehicles_vin_format_check') THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_vin_format_check CHECK (vin ~ '^[A-HJ-NPR-Z0-9]{17}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='service_records'::regclass AND conname='service_records_vehicle_vin_fkey') THEN
    ALTER TABLE service_records ADD CONSTRAINT service_records_vehicle_vin_fkey
      FOREIGN KEY (vehicle_id, vin) REFERENCES vehicles(id, vin);
  END IF;
END $$;

ALTER TABLE ownership_claims ADD CONSTRAINT ownership_claims_vehicle_id_fkey FOREIGN KEY(vehicle_id) REFERENCES vehicles(id);
ALTER TABLE service_records ADD CONSTRAINT service_records_vehicle_id_fkey FOREIGN KEY(vehicle_id) REFERENCES vehicles(id);
ALTER TABLE modifications ADD CONSTRAINT modifications_vehicle_id_fkey FOREIGN KEY(vehicle_id) REFERENCES vehicles(id);
ALTER TABLE workshop_bookings ADD CONSTRAINT workshop_bookings_vehicle_id_fkey FOREIGN KEY(vehicle_id) REFERENCES vehicles(id);
ALTER TABLE vehicle_reference_uses ADD CONSTRAINT vehicle_reference_uses_vehicle_id_fkey FOREIGN KEY(vehicle_id) REFERENCES vehicles(id);
ALTER TABLE vehicle_transfers ADD CONSTRAINT vehicle_transfers_vehicle_id_fkey FOREIGN KEY(vehicle_id) REFERENCES vehicles(id);
ALTER TABLE sales_pack_orders ADD CONSTRAINT sales_pack_orders_vehicle_id_fkey FOREIGN KEY(vehicle_id) REFERENCES vehicles(id);
ALTER TABLE reminder_deliveries ADD CONSTRAINT reminder_deliveries_vehicle_id_fkey FOREIGN KEY(vehicle_id) REFERENCES vehicles(id);
CREATE TRIGGER immutable_service_history BEFORE UPDATE OR DELETE ON service_records FOR EACH ROW EXECUTE FUNCTION protect_vault_history();
