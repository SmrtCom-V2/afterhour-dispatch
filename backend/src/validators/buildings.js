import { z } from 'zod';

// .passthrough() on every schema below is deliberate: the frontend form
// (PmWorkspace.jsx) sends more fields than this route currently persists
// (basementUnits, parkingLocation, hasGardenFront/Back/Side, gardenNotes,
// hasRooftopAccess, hasPool, hasBoilerRoom, hasStorageUnits, hasLaundryRoom,
// hasBikeStorage, hasMailroom, hasSprinklerSystem, hasFireAlarm,
// hasSecurityCameras, hasIntercom, heatingType, heatingShutoffLocation) —
// the route silently ignores them today. Rejecting unknown keys here would
// break real traffic; only the fields the route actually reads are typed.

const nullableString = z.string().nullish();

export const createBuildingSchema = z.object({
  pmCompanyId: z.string().min(1, 'pmCompanyId is required'),
  name: nullableString,
  address: z.string().min(1, 'address is required'),
  city: nullableString,
  postalCode: nullableString,
  country: nullableString,
  buildingType: nullableString,
  totalUnits: z.coerce.number().int().nonnegative().nullish(),
  totalFloors: z.coerce.number().int().nonnegative().nullish(),
  hasBasement: z.boolean().nullish(),
  basementFloors: z.coerce.number().int().nonnegative().nullish(),
  hasPenthouse: z.boolean().nullish(),
  numEntrances: z.coerce.number().int().nonnegative().nullish(),
  entranceNames: z.array(z.string()).nullish(),
  unitsPerFloor: z.coerce.number().int().nonnegative().nullish(),
  unitNumberingFormat: nullableString,
  hasElevator: z.boolean().nullish(),
  numElevators: z.coerce.number().int().nonnegative().nullish(),
  parkingType: nullableString,
  parkingSpaces: z.coerce.number().int().nonnegative().nullish(),
  keySafeLocation: nullableString,
  keySafeCode: nullableString,
  gateCode: nullableString,
  mainEntranceCode: nullableString,
  waterShutoffLocation: nullableString,
  gasShutoffLocation: nullableString,
  electricShutoffLocation: nullableString,
  specialAccessInstructions: nullableString,
  janitorName: nullableString,
  janitorPhone: nullableString,
  janitorEmail: nullableString,
  emergencyContactName: nullableString,
  emergencyContactPhone: nullableString,
  specialInstructions: nullableString,
  knownIssues: nullableString,
  notes: nullableString,
  status: nullableString,
}).passthrough();

// Same shape as create, but nothing is required — PUT sends whatever changed
// and the route COALESCEs against existing DB values.
export const updateBuildingSchema = createBuildingSchema
  .partial()
  .omit({ pmCompanyId: true })
  .passthrough();

export const bulkImportBuildingsSchema = z.object({
  pmCompanyId: z.string().min(1, 'pmCompanyId is required'),
  buildings: z.array(z.object({
    address: z.string().min(1, 'address is required'),
    name: nullableString,
    city: nullableString,
    postalCode: nullableString,
    country: nullableString,
    buildingType: nullableString,
    totalUnits: z.coerce.number().int().nonnegative().nullish(),
  }).passthrough()).min(1, 'buildings array must not be empty'),
}).passthrough();

export const assignSpToBuildingSchema = z.object({
  serviceProviderId: z.string().min(1, 'serviceProviderId is required'),
  priority: z.coerce.number().int().nullish(),
}).passthrough();
