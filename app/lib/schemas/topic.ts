import { z } from 'zod';

/**
 * Topic schema: お題（トピック）
 */
export const TopicSchema = z.object({
  // id can be string (UUID/slug) or number (legacy/mock). Accept both for compatibility.
  id: z.union([z.string(), z.number()]),
  title: z.string().min(1).max(200),
  created_at: z.string(),
  // optional image URL for image-based topics (thumbnail or full image)
  image: z.string().url().optional(),
});

export type Topic = z.infer<typeof TopicSchema>;
