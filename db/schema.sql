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
  garage_logo_url TEXT NOT NULL DEFAULT '',
  imi_accreditation TEXT NOT NULL DEFAULT '',
  garage_address TEXT NOT NULL DEFAULT '',
  garage_phone TEXT NOT NULL DEFAULT '',
  support_email TEXT NOT NULL DEFAULT '',
  garage_accreditations TEXT[] NOT NULL DEFAULT '{}',
  workshop_type TEXT NOT NULL DEFAULT 'garage' CHECK (workshop_type IN ('garage','specialist')),
  vat_verified BOOLEAN NOT NULL DEFAULT false,
  vat_verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  subscription_status TEXT NOT NULL DEFAULT 'inactive' CHECK (subscription_status IN ('inactive','trialing','active','past_due','canceled','expired')),
  trial_expires_at TIMESTAMPTZ,
  is_sample BOOLEAN NOT NULL DEFAULT false
  ,dev_role TEXT,
  display_preference TEXT NOT NULL DEFAULT 'easy' CHECK (display_preference IN ('easy','detailed'))
);
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS display_preference TEXT NOT NULL DEFAULT 'easy' CHECK (display_preference IN ('easy','detailed'));
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS workshop_type TEXT NOT NULL DEFAULT 'garage' CHECK (workshop_type IN ('garage','specialist'));
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS garage_logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS imi_accreditation TEXT NOT NULL DEFAULT '';
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS garage_address TEXT NOT NULL DEFAULT '';
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS garage_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS support_email TEXT NOT NULL DEFAULT '';
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS garage_accreditations TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS garage_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS vat_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS vat_verified_at TIMESTAMPTZ;
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive' CHECK (subscription_status IN ('inactive','trialing','active','past_due','canceled','expired'));
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS webauthn_user_handle TEXT UNIQUE;
ALTER TABLE user_accounts ALTER COLUMN email DROP NOT NULL;
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  credential_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  user_handle TEXT NOT NULL,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0 CHECK (counter >= 0),
  transports TEXT[] NOT NULL DEFAULT '{}',
  device_type TEXT NOT NULL CHECK (device_type IN ('singleDevice','multiDevice')),
  backed_up BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS webauthn_credentials_user_idx ON webauthn_credentials(user_id);
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY,
  flow TEXT NOT NULL CHECK (flow IN ('registration','authentication')),
  user_id TEXT REFERENCES user_accounts(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  origin TEXT NOT NULL,
  rp_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webauthn_challenges_expiry_idx ON webauthn_challenges(expires_at);
CREATE TABLE IF NOT EXISTS webauthn_sessions (
  token_hash TEXT PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  user_id TEXT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webauthn_sessions_user_idx ON webauthn_sessions(user_id, expires_at);
CREATE TABLE IF NOT EXISTS tier_overrides (
  user_id TEXT PRIMARY KEY REFERENCES user_accounts(id) ON DELETE CASCADE,
  tier_override TEXT NOT NULL CHECK (tier_override = 'pro_modder_lifetime'),
  granted_by TEXT NOT NULL REFERENCES user_accounts(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tier_overrides_granted_by_idx ON tier_overrides(granted_by);
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
    IF current_setting('v5vault.account_anonymization',true)='on'
      AND (to_jsonb(NEW)-'previous_keeper_id'-'new_keeper_id'-'approved_by'-'history_snapshot')
        IS NOT DISTINCT FROM
          (to_jsonb(OLD)-'previous_keeper_id'-'new_keeper_id'-'approved_by'-'history_snapshot') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Keeper transfer history is immutable';
  END IF;
  IF TG_TABLE_NAME='service_records' AND current_setting('v5vault.account_anonymization',true)='on'
    AND (to_jsonb(NEW)-'created_by_user_id'-'stamped_by_garage_id'-'stamped_by_user_id'-'stamp_signature'-'data')
      IS NOT DISTINCT FROM
        (to_jsonb(OLD)-'created_by_user_id'-'stamped_by_garage_id'-'stamped_by_user_id'-'stamp_signature'-'data') THEN
    RETURN NEW;
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
    IF current_setting('v5vault.account_anonymization',true)='on' AND NEW.owner_user_id IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Vehicle already registered to an active keeper.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS immutable_vehicle_keeper ON vehicles;
CREATE TRIGGER immutable_vehicle_keeper BEFORE UPDATE OF owner_user_id ON vehicles
  FOR EACH ROW EXECUTE FUNCTION prevent_active_keeper_overwrite();
DROP TRIGGER IF EXISTS immutable_modification_history ON modifications;
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
UPDATE modifications m SET data=COALESCE(m.data,'{}'::jsonb) || jsonb_build_object('vin',v.vin)
  FROM vehicles v WHERE m.vehicle_id=v.id AND m.data->>'vin' IS DISTINCT FROM v.vin;
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
CREATE TRIGGER immutable_modification_history BEFORE UPDATE OR DELETE ON modifications FOR EACH ROW EXECUTE FUNCTION protect_vault_history();
CREATE OR REPLACE FUNCTION prevent_vehicle_identity_mutation() RETURNS trigger AS $$
BEGIN
  IF NEW.vin IS DISTINCT FROM OLD.vin OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Vehicle VIN identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS immutable_vehicle_identity ON vehicles;
CREATE TRIGGER immutable_vehicle_identity BEFORE UPDATE OF vin,id ON vehicles
  FOR EACH ROW EXECUTE FUNCTION prevent_vehicle_identity_mutation();
CREATE OR REPLACE FUNCTION protect_modification_vehicle_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE canonical_vin TEXT;
BEGIN
  SELECT vin INTO canonical_vin FROM vehicles WHERE id=NEW.vehicle_id;
  IF canonical_vin IS NULL OR NEW.data->>'vin' IS DISTINCT FROM canonical_vin THEN
    RAISE EXCEPTION 'Modification VIN must match the linked vehicle';
  END IF;
  IF TG_OP='UPDATE' AND
     (NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR NEW.data->>'vin' IS DISTINCT FROM OLD.data->>'vin') THEN
    RAISE EXCEPTION 'Modification history cannot be moved to a different vehicle or VIN';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS immutable_modification_vehicle_binding ON modifications;
CREATE TRIGGER immutable_modification_vehicle_binding BEFORE INSERT OR UPDATE ON modifications
  FOR EACH ROW EXECUTE FUNCTION protect_modification_vehicle_binding();

-- Current keeper registration is mutable; service, receipt, MOT and build history
-- retain an explicit FK to the immutable vehicle VIN.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS verification_state TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION';
DO $$ BEGIN
  ALTER TABLE vehicles ADD CONSTRAINT vehicles_verification_state_check
    CHECK (verification_state IN ('PENDING_VERIFICATION','VERIFIED','RE_VERIFICATION_REQUIRED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only claims reviewed by an administrator count as verified. Development and
-- sample approvals remain pending because they are not live V5C evidence.
UPDATE vehicles v SET verification_state='VERIFIED'
WHERE v.owner_user_id IS NOT NULL AND v.status='approved' AND NOT v.is_sample
  AND EXISTS (SELECT 1 FROM ownership_claims c WHERE c.vehicle_id=v.id
    AND c.status='approved' AND c.reviewed_by IS NOT NULL);

CREATE TABLE IF NOT EXISTS vehicle_registrations (
  vin TEXT PRIMARY KEY REFERENCES vehicles(vin) ON UPDATE RESTRICT,
  vrm TEXT NOT NULL UNIQUE,
  v5c_reference_hash TEXT,
  verification_state TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
    CHECK (verification_state IN ('PENDING_VERIFICATION','VERIFIED','RE_VERIFICATION_REQUIRED')),
  last_verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO vehicle_registrations(vin,vrm,v5c_reference_hash,verification_state,last_verified_at)
SELECT v.vin,v.vrm,v.v5c_reference_hash,v.verification_state,
  CASE WHEN v.verification_state='VERIFIED' THEN now() ELSE NULL END
FROM vehicles v
ON CONFLICT(vin) DO UPDATE SET
  vrm=EXCLUDED.vrm,
  v5c_reference_hash=COALESCE(EXCLUDED.v5c_reference_hash,vehicle_registrations.v5c_reference_hash),
  verification_state=EXCLUDED.verification_state,
  last_verified_at=COALESCE(EXCLUDED.last_verified_at,vehicle_registrations.last_verified_at),
  updated_at=now();

CREATE TABLE IF NOT EXISTS vehicle_verification_requests (
  id TEXT PRIMARY KEY,
  vin TEXT NOT NULL REFERENCES vehicles(vin) ON UPDATE RESTRICT,
  user_id TEXT NOT NULL REFERENCES user_accounts(id),
  requested_vrm TEXT NOT NULL,
  v5c_reference_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_reason TEXT,
  reviewed_by TEXT REFERENCES user_accounts(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_verification_one_pending_idx
  ON vehicle_verification_requests(vin) WHERE status='pending';
CREATE INDEX IF NOT EXISTS vehicle_verification_review_idx
  ON vehicle_verification_requests(status,created_at);

-- Give every durable child record its own VIN FK rather than relying only on
-- a mutable registration or an indirect vehicle_id relationship.
-- Temporarily remove immutable-history triggers so only the new VIN columns
-- can be backfilled; the original payload and keeper history remain unchanged.
DROP TRIGGER IF EXISTS immutable_modification_history ON modifications;
DROP TRIGGER IF EXISTS immutable_keeper_history ON vehicle_transfers;
ALTER TABLE modifications ADD COLUMN IF NOT EXISTS vin TEXT;
UPDATE modifications m SET vin=v.vin FROM vehicles v WHERE m.vehicle_id=v.id AND m.vin IS NULL;
ALTER TABLE modifications ALTER COLUMN vin SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE modifications ADD CONSTRAINT modifications_vin_fkey
    FOREIGN KEY(vin) REFERENCES vehicles(vin) ON UPDATE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE service_attachments ADD COLUMN IF NOT EXISTS vin TEXT;
UPDATE service_attachments a SET vin=s.vin FROM service_records s
  WHERE a.service_record_id=s.id AND a.vin IS NULL;
ALTER TABLE service_attachments ALTER COLUMN vin SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE service_attachments ADD CONSTRAINT service_attachments_vin_fkey
    FOREIGN KEY(vin) REFERENCES vehicles(vin) ON UPDATE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE vehicle_reference_uses ADD COLUMN IF NOT EXISTS vin TEXT;
UPDATE vehicle_reference_uses u SET vin=v.vin FROM vehicles v
  WHERE u.vehicle_id=v.id AND u.vin IS NULL;
ALTER TABLE vehicle_reference_uses ALTER COLUMN vin SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE vehicle_reference_uses ADD CONSTRAINT vehicle_reference_uses_vin_fkey
    FOREIGN KEY(vin) REFERENCES vehicles(vin) ON UPDATE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE vehicle_transfers ADD COLUMN IF NOT EXISTS vin TEXT;
UPDATE vehicle_transfers t SET vin=v.vin FROM vehicles v
  WHERE t.vehicle_id=v.id AND t.vin IS NULL;
ALTER TABLE vehicle_transfers ALTER COLUMN vin SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE vehicle_transfers ADD CONSTRAINT vehicle_transfers_vin_fkey
    FOREIGN KEY(vin) REFERENCES vehicles(vin) ON UPDATE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE sales_pack_orders ADD COLUMN IF NOT EXISTS vin TEXT;
UPDATE sales_pack_orders o SET vin=v.vin FROM vehicles v
  WHERE o.vehicle_id=v.id AND o.vin IS NULL;
ALTER TABLE sales_pack_orders ALTER COLUMN vin SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE sales_pack_orders ADD CONSTRAINT sales_pack_orders_vin_fkey
    FOREIGN KEY(vin) REFERENCES vehicles(vin) ON UPDATE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS mot_records (
  id TEXT PRIMARY KEY,
  vin TEXT NOT NULL REFERENCES vehicles(vin) ON UPDATE RESTRICT,
  record_hash TEXT NOT NULL,
  data JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vin,record_hash)
);
INSERT INTO mot_records(id,vin,record_hash,data)
SELECT md5(v.vin || ':' || md5(mot.data::text)),v.vin,md5(mot.data::text),mot.data
FROM vehicles v
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(v.data->'motHistory')='array' THEN v.data->'motHistory' ELSE '[]'::jsonb END
) AS mot(data)
ON CONFLICT(vin,record_hash) DO NOTHING;

CREATE OR REPLACE FUNCTION capture_vehicle_mot_records() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO mot_records(id,vin,record_hash,data)
  SELECT md5(NEW.vin || ':' || md5(mot.data::text)),NEW.vin,md5(mot.data::text),mot.data
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(NEW.data->'motHistory')='array' THEN NEW.data->'motHistory' ELSE '[]'::jsonb END
  ) AS mot(data)
  ON CONFLICT(vin,record_hash) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS capture_vehicle_mot_records ON vehicles;
CREATE TRIGGER capture_vehicle_mot_records AFTER INSERT OR UPDATE OF data ON vehicles
  FOR EACH ROW EXECUTE FUNCTION capture_vehicle_mot_records();

CREATE OR REPLACE FUNCTION populate_vehicle_child_vin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE canonical_vin TEXT;
BEGIN
  SELECT vin INTO canonical_vin FROM vehicles WHERE id=NEW.vehicle_id;
  IF canonical_vin IS NULL THEN RAISE EXCEPTION 'The VIN-anchored vehicle does not exist'; END IF;
  IF NEW.vin IS NOT NULL AND NEW.vin IS DISTINCT FROM canonical_vin THEN
    RAISE EXCEPTION 'The record VIN does not match its vehicle';
  END IF;
  NEW.vin := canonical_vin;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS populate_modification_vin ON modifications;
CREATE TRIGGER populate_modification_vin BEFORE INSERT OR UPDATE OF vehicle_id,vin ON modifications
  FOR EACH ROW EXECUTE FUNCTION populate_vehicle_child_vin();
DROP TRIGGER IF EXISTS populate_reference_use_vin ON vehicle_reference_uses;
CREATE TRIGGER populate_reference_use_vin BEFORE INSERT OR UPDATE OF vehicle_id,vin ON vehicle_reference_uses
  FOR EACH ROW EXECUTE FUNCTION populate_vehicle_child_vin();
DROP TRIGGER IF EXISTS populate_vehicle_transfer_vin ON vehicle_transfers;
CREATE TRIGGER populate_vehicle_transfer_vin BEFORE INSERT OR UPDATE OF vehicle_id,vin ON vehicle_transfers
  FOR EACH ROW EXECUTE FUNCTION populate_vehicle_child_vin();
DROP TRIGGER IF EXISTS populate_sales_pack_vin ON sales_pack_orders;
CREATE TRIGGER populate_sales_pack_vin BEFORE INSERT OR UPDATE OF vehicle_id,vin ON sales_pack_orders
  FOR EACH ROW EXECUTE FUNCTION populate_vehicle_child_vin();

CREATE OR REPLACE FUNCTION populate_service_attachment_vin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE canonical_vin TEXT;
BEGIN
  SELECT vin INTO canonical_vin FROM service_records WHERE id=NEW.service_record_id;
  IF canonical_vin IS NULL THEN RAISE EXCEPTION 'The VIN-anchored service record does not exist'; END IF;
  IF NEW.vin IS NOT NULL AND NEW.vin IS DISTINCT FROM canonical_vin THEN
    RAISE EXCEPTION 'The attachment VIN does not match its service record';
  END IF;
  NEW.vin := canonical_vin;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS populate_service_attachment_vin ON service_attachments;
CREATE TRIGGER populate_service_attachment_vin BEFORE INSERT OR UPDATE OF service_record_id,vin ON service_attachments
  FOR EACH ROW EXECUTE FUNCTION populate_service_attachment_vin();

CREATE TRIGGER immutable_modification_history BEFORE UPDATE OR DELETE ON modifications
  FOR EACH ROW EXECUTE FUNCTION protect_vault_history();
CREATE TRIGGER immutable_keeper_history BEFORE UPDATE OR DELETE ON vehicle_transfers
  FOR EACH ROW EXECUTE FUNCTION protect_vault_history();

CREATE OR REPLACE FUNCTION guard_vehicle_registration_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.vrm IS DISTINCT FROM OLD.vrm
     AND current_setting('v5vault.allow_registration_update',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Use the V5C re-verification flow to change a vehicle registration';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_vehicle_registration_change ON vehicles;
CREATE TRIGGER guard_vehicle_registration_change BEFORE UPDATE OF vrm ON vehicles
  FOR EACH ROW EXECUTE FUNCTION guard_vehicle_registration_change();

CREATE OR REPLACE FUNCTION guard_verified_vehicle_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.verification_state='VERIFIED'
     AND current_setting('v5vault.allow_verification_update',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Vehicle verification requires reviewed V5C evidence';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS require_reviewed_vehicle_verification_insert ON vehicles;
CREATE TRIGGER require_reviewed_vehicle_verification_insert BEFORE INSERT ON vehicles
  FOR EACH ROW EXECUTE FUNCTION guard_verified_vehicle_state();
DROP TRIGGER IF EXISTS require_reviewed_vehicle_verification_update ON vehicles;
CREATE TRIGGER require_reviewed_vehicle_verification_update BEFORE UPDATE OF verification_state ON vehicles
  FOR EACH ROW EXECUTE FUNCTION guard_verified_vehicle_state();
DROP TRIGGER IF EXISTS require_reviewed_registration_verification_insert ON vehicle_registrations;
CREATE TRIGGER require_reviewed_registration_verification_insert BEFORE INSERT ON vehicle_registrations
  FOR EACH ROW EXECUTE FUNCTION guard_verified_vehicle_state();
DROP TRIGGER IF EXISTS require_reviewed_registration_verification_update ON vehicle_registrations;
CREATE TRIGGER require_reviewed_registration_verification_update BEFORE UPDATE OF verification_state ON vehicle_registrations
  FOR EACH ROW EXECUTE FUNCTION guard_verified_vehicle_state();

CREATE OR REPLACE FUNCTION guard_vehicle_registration_record_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.vrm IS DISTINCT FROM OLD.vrm
     AND current_setting('v5vault.allow_registration_update',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Use the V5C re-verification flow to change a vehicle registration';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_vehicle_registration_record_change ON vehicle_registrations;
CREATE TRIGGER guard_vehicle_registration_record_change BEFORE UPDATE OF vrm ON vehicle_registrations
  FOR EACH ROW EXECUTE FUNCTION guard_vehicle_registration_record_change();
