import { z } from 'zod';

/**
 * Answer schema: 大喜利の回答を表現する最小スキーマ
 */
export const AnswerSchema = z
  .object({
    id: z.number(),
    text: z.string().min(1).max(1000),
    profileId: z.string().optional(),
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
    favorited: z.boolean().optional(), // whether the current user has favorited this answer
    favCount: z.number().int().nonnegative().optional().default(0), // favorite count
  })

export type Answer = z.infer<typeof AnswerSchema>;
