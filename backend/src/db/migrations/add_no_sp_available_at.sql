-- Fixes a live bug: pickupExternalEmergencyDispatches (scheduler.js, runs
-- every minute) kept re-picking up incidents where zero service providers
-- are configured for the building/trade — startDispatch found nothing,
-- escalated to FM, but nothing distinguished that from "still waiting for
-- a human," so it retried once a minute for up to 60 minutes straight.
ALTER TABLE incident
ADD COLUMN IF NOT EXISTS no_sp_available_at TIMESTAMP WITH TIME ZONE;
