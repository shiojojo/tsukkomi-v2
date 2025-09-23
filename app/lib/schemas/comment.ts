import { z } from 'zod';

/**
 * Comment schema: 回答に紐づくコメント
 *
 * Note (migration): `author` / `authorId` are accepted for backward compatibility
 * and are mapped to `profileId`. Plan to remove legacy fields once DB rows and
 * client code have fully migrated to `profileId`.
 */
export const CommentSchema = z
  .object({
    id: z.number(),
    answerId: z.union([z.number(), z.string()]),
    text: z.string().min(1).max(500),
  profileId: z.string().optional(),
    created_at: z.string(),
  })
  .transform(c => ({ ...c }));

export type Comment = z.infer<typeof CommentSchema>;
