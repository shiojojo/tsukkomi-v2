import { z } from 'zod';

/**
 * Answer schema: 大喜利の回答を表現する最小スキーマ
 *
 * Note (migration): Historically this schema allowed `author` / `authorId`.
 * New canonical identity field is `profileId`. To preserve backward compatibility
 * we accept `authorId` and map it to `profileId` in a transform. This behavior is
 * temporary and marked for deprecation — remove `author`/`authorId` handling once
 * all callers and stored rows have migrated to `profile_id`.
 */
export const AnswerSchema = z
  .object({
    id: z.number(),
    text: z.string().min(1).max(1000),
    author: z.string().optional(),
    // profileId replaces authorId (deprecated). Keep both for transition.
    profileId: z.string().optional(),
  authorId: z.string().optional(),
    topicId: z.union([z.string(), z.number()]).optional(),
    created_at: z.string(),
    votes: z
      .object({
        level1: z.number().int().nonnegative(),
        level2: z.number().int().nonnegative(),
        level3: z.number().int().nonnegative(),
      })
      .optional()
      .default({ level1: 0, level2: 0, level3: 0 }),
    votesBy: z.record(z.number().int()).optional().default({}),
  })
  .transform(a => {
    // normalize legacy authorId -> profileId for transition
    const normalized = { ...a, profileId: a.profileId ?? a.authorId };
    return normalized;
  });

export type Answer = z.infer<typeof AnswerSchema>;
