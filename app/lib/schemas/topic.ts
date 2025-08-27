import { z } from 'zod';

/**
 * Topic schema: お題（トピック）
 */
export const TopicSchema = z.object({
  // id can be string (UUID/slug) or number (legacy/mock). Accept both for compatibility.
  id: z.union([z.string(), z.number()]),
  title: z.string().min(1).max(200),
});

export type Topic = z.infer<typeof TopicSchema>;
