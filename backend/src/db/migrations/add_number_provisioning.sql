-- Phone Number Provisioning & Call-Routing
-- Spec: AFTERHOUR_PHONE_NUMBER_PROVISIONING_SPEC.md (2026-08-31)
--
-- Adds the ability for each paying customer to have a dedicated after-hours
-- number that tenant calls route through. Two models:
--   'provisioned'  - a Twilio DID we bought and own, published to tenants
--   'byo_forward'  - customer keeps their published number, forwards it to our DID
--   'port_in'      - customer's number ported to us (enterprise, manual, rare)
--
-- Routing is per-pm_company (voiceBrain resolves the dialled To= number to
-- an fm_company via pm_company.service_phone). This migration does NOT change
-- that resolver; it adds the columns + inventory table + safety constraints
-- around it, and makes service_phone impossible to collide on.

-- ── fm_company ────────────────────────────────────────────────────────────
-- Twilio subaccount is per-FM. NULL until the first number is provisioned.
-- Phase 1 decision (spec §7): single shared Twilio account, subaccount_sid
-- stays NULL for now — column added so we can move to per-customer
-- subaccounts later without another migration.
ALTER TABLE fm_company
  ADD COLUMN IF NOT EXISTS twilio_subaccount_sid VARCHAR(64);

-- ── pm_company ────────────────────────────────────────────────────────────
-- service_phone already exists (002_update_schema.sql). Add the lifecycle
-- state, the Twilio SID of the DID we bought, the customer's own published
-- number (byo_forward only, display-only), and the model selector.
ALTER TABLE pm_company
  ADD COLUMN IF NOT EXISTS telephony_model VARCHAR(20) NOT NULL DEFAULT 'provisioned'
    CHECK (telephony_model IN ('provisioned', 'byo_forward', 'port_in'));

ALTER TABLE pm_company
  ADD COLUMN IF NOT EXISTS service_phone_status VARCHAR(20) NOT NULL DEFAULT 'unassigned'
    CHECK (service_phone_status IN (
      'unassigned',        -- no number yet
      'provisioning',      -- Twilio purchase in progress / just bought, not verified
      'forwarding_pending',-- byo_forward: DID ready, waiting for customer to set up + verify forwarding
      'port_pending',      -- port_in: LOA signed, waiting on carrier
      'active',            -- verified by a real test call, live
      'released'           -- number given back to Twilio (offboard)
    ));

ALTER TABLE pm_company
  ADD COLUMN IF NOT EXISTS twilio_number_sid VARCHAR(64);

-- byo_forward: the number the customer publishes to their tenants and forwards
-- FROM. Informational only — the routable target is still our provisioned DID
-- in service_phone (that's what Twilio delivers as To=).
ALTER TABLE pm_company
  ADD COLUMN IF NOT EXISTS published_number VARCHAR(50);

ALTER TABLE pm_company
  ADD COLUMN IF NOT EXISTS forwarding_verified_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE pm_company
  ADD COLUMN IF NOT EXISTS service_phone_verified_at TIMESTAMP WITH TIME ZONE;

-- Two different customers must NEVER share a routing number. The voiceBrain
-- resolver only *detects* a collision at call time and errors the call —
-- this makes the collision impossible to create in the first place.
-- Partial: only enforced for numbers actually in service.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_company_service_phone_active
  ON pm_company (service_phone)
  WHERE service_phone IS NOT NULL
    AND service_phone_status IN ('provisioning', 'forwarding_pending', 'port_pending', 'active');

-- ── provisioned_number (inventory + audit) ────────────────────────────────
-- One row per DID we have ever bought. Survives release (status='released',
-- released_at set) so we keep a full history of what we paid Twilio for.
CREATE TABLE IF NOT EXISTS provisioned_number (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fm_company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
  pm_company_id UUID REFERENCES pm_company(id) ON DELETE SET NULL, -- NULL until bound
  twilio_number_sid VARCHAR(64) NOT NULL UNIQUE,
  e164_number VARCHAR(50) NOT NULL,
  region VARCHAR(100),                 -- e.g. 'DE-Berlin', 'DE-national'
  number_type VARCHAR(20) DEFAULT 'local' CHECK (number_type IN ('local', 'national', 'mobile', 'tollfree')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  monthly_cost_cents INTEGER,          -- what Twilio charges US / month (our cost)
  billed_cents INTEGER,                -- what we charge the CUSTOMER / month (cost + margin); NULL = folded into plan
  stripe_subscription_item_id VARCHAR(64), -- the add-on line item on the customer's subscription, if billed separately
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provisioned_number_fm ON provisioned_number(fm_company_id);
CREATE INDEX IF NOT EXISTS idx_provisioned_number_pm ON provisioned_number(pm_company_id);
CREATE INDEX IF NOT EXISTS idx_provisioned_number_status ON provisioned_number(status);

-- ── telephony_verification (test-call log) ────────────────────────────────
-- Every attempt to prove routing works end to end. A pm_company only reaches
-- service_phone_status='active' after a row here with result='success'.
CREATE TABLE IF NOT EXISTS telephony_verification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pm_company_id UUID NOT NULL REFERENCES pm_company(id) ON DELETE CASCADE,
  model VARCHAR(20) NOT NULL,          -- provisioned | byo_forward
  dialed_number VARCHAR(50),           -- what was called
  resolved_fm_company_id UUID,         -- what the resolver returned (should match)
  result VARCHAR(20) NOT NULL CHECK (result IN ('pending', 'success', 'failed', 'timeout')),
  detail TEXT,                         -- error / diagnostic text
  twilio_call_sid VARCHAR(64),
  initiated_by VARCHAR(20),            -- 'customer' | 'sa_rep' | 'health_check'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_telephony_verification_pm ON telephony_verification(pm_company_id);

-- ── incident: record which caller class reported it ───────────────────────
-- Groundwork for the private-owner-as-caller feature (separate spec). Tenant
-- is still the default and only implemented class today; 'owner' lands with
-- that feature. Nullable, no behaviour change now.
ALTER TABLE incident
  ADD COLUMN IF NOT EXISTS caller_type VARCHAR(20) DEFAULT 'tenant'
    CHECK (caller_type IN ('tenant', 'owner', 'unknown'));
