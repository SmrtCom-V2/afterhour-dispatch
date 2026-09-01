import { z } from 'zod';

export const createCheckoutSchema = z.object({
  priceId: z.string().min(1).nullish(),
  successUrl: z.string().url().nullish(),
  cancelUrl: z.string().url().nullish(),
  wantDedicatedNumber: z.boolean().nullish(),
}).passthrough();
