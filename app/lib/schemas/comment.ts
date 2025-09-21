import { z } from 'zod';

/**
 * Comment schema: 回答に紐づくコメント
 */
export const CommentSchema = z
  .object({
    id: z.number(),
    answerId: z.union([z.number(), z.string()]),
    text: z.string().min(1).max(500),
    author: z.string().optional(),
    profileId: z.string().optional(),
    authorId: z.string().optional(),
    created_at: z.string(),
  })
  .transform(c => ({ ...c, profileId: c.profileId ?? c.authorId }));

export type Comment = z.infer<typeof CommentSchema>;
