import { z } from 'zod';

// Health check response — proves end-to-end works
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
  dbConnected: z.boolean(),
  userCount: z.number(),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Common error envelope
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
