import { z } from 'zod';

export const closeIncidentSchema = z.object({
  reason: z.string().nullish(),
}).passthrough();

export const translateIncidentSchema = z.object({
  targetLanguage: z.enum(['de', 'en'], {
    errorMap: () => ({ message: 'targetLanguage must be one of: de, en' }),
  }),
}).passthrough();
