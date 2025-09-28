import { z } from 'zod';

/**
 * Comment schema: 回答に紐づくコメント
 */
export const CommentSchema = z
  .object({
    id: z.number(),
    answerId: z.union([z.number(), z.string()]),
    text: z.string().min(1).max(500),
    profileId: z.string().optional(),
    created_at: z.string(),
  })

export type Comment = z.infer<typeof CommentSchema>;
