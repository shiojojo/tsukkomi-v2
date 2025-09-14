import { z } from 'zod';

/**
 * Comment schema: 回答に紐づくコメント
 */
export const CommentSchema = z.object({
  id: z.number(),
  // answerId links to Answer.id (mock uses numbers). Accept number or string for flexibility.
  answerId: z.union([z.number(), z.string()]),
  text: z.string().min(1).max(500),
  author: z.string().optional(),
  authorId: z.string().optional(),
  created_at: z.string(),
});

export type Comment = z.infer<typeof CommentSchema>;
