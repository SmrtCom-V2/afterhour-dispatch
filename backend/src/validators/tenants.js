import { z } from 'zod';

// .passthrough(): PmWorkspace.jsx's tenant form also sends email, floor,
// entrance, notes — fields the route doesn't currently read or persist.
// Only what the route actually uses is typed/required here.

// tenant.title becomes the two-value enum ("Mister"|"Missus"|null) the voice
// brain maps to Herr/Frau for the recognized-caller greeting (see
// voiceBrain.js greetingNameDe). Accepted loosely here (any string) and
// normalized by the route's normalizeTitle() — "Herr"/"Frau"/"Mr"/blank/junk
// all resolve safely, so one sloppy CSV cell can't 400 the whole import.
const titleSchema = z.string().nullish();

export const createTenantSchema = z.object({
  buildingId: z.string().min(1, 'buildingId is required'),
  name: z.string().min(1, 'name is required'),
  phone: z.string().min(1, 'phone is required'),
  unit: z.string().nullish(),
  title: titleSchema,
  status: z.string().nullish(),
}).passthrough();

export const updateTenantSchema = z.object({
  name: z.string().min(1).nullish(),
  phone: z.string().min(1).nullish(),
  unit: z.string().nullish(),
  title: titleSchema,
  status: z.string().nullish(),
}).passthrough();

export const bulkImportTenantsSchema = z.object({
  buildingId: z.string().min(1, 'buildingId is required'),
  tenants: z.array(z.object({
    name: z.string().min(1, 'name is required'),
    phone: z.string().min(1, 'phone is required'),
    unit: z.string().nullish(),
    title: titleSchema,
  }).passthrough()).min(1, 'tenants array must not be empty'),
}).passthrough();
