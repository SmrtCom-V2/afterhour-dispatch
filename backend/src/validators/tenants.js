import { z } from 'zod';

// .passthrough(): PmWorkspace.jsx's tenant form also sends email, floor,
// entrance, notes — fields the route doesn't currently read or persist.
// Only what the route actually uses is typed/required here.

export const createTenantSchema = z.object({
  buildingId: z.string().min(1, 'buildingId is required'),
  name: z.string().min(1, 'name is required'),
  phone: z.string().min(1, 'phone is required'),
  unit: z.string().nullish(),
  status: z.string().nullish(),
}).passthrough();

export const updateTenantSchema = z.object({
  name: z.string().min(1).nullish(),
  phone: z.string().min(1).nullish(),
  unit: z.string().nullish(),
  status: z.string().nullish(),
}).passthrough();

export const bulkImportTenantsSchema = z.object({
  buildingId: z.string().min(1, 'buildingId is required'),
  tenants: z.array(z.object({
    name: z.string().min(1, 'name is required'),
    phone: z.string().min(1, 'phone is required'),
    unit: z.string().nullish(),
  }).passthrough()).min(1, 'tenants array must not be empty'),
}).passthrough();
