import { z } from 'zod';

/**
 * Answer schema: 大喜利の回答を表現する最小スキーマ
 */
export const AnswerSchema = z.object({
  id: z.number(),
  text: z.string().min(1).max(1000),
  author: z.string().optional(),
  // optional author id to associate answers with a user
  authorId: z.string().optional(),
  // topicId links an answer to a Topic.id. Accept string or number for compatibility.
  topicId: z.union([z.string(), z.number()]).optional(),
  created_at: z.string(),
  // votes: three-level rating counts. Defaults to zeros when missing.
  votes: z
    .object({
      level1: z.number().int().nonnegative(),
      level2: z.number().int().nonnegative(),
      level3: z.number().int().nonnegative(),
    })
    .optional()
    .default({ level1: 0, level2: 0, level3: 0 }),
  // votesBy: map userId -> chosen level (1|2|3). Stored as number values.
  votesBy: z.record(z.number().int()).optional().default({}),
});

export type Answer = z.infer<typeof AnswerSchema>;
