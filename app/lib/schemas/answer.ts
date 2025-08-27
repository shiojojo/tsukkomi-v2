import { z } from 'zod';

/**
 * Answer schema: 大喜利の回答を表現する最小スキーマ
 */
export const AnswerSchema = z.object({
  id: z.number(),
  text: z.string().min(1).max(1000),
  author: z.string().optional(),
  // topicId links an answer to a Topic.id. Accept string or number for compatibility.
  topicId: z.union([z.string(), z.number()]).optional(),
  created_at: z.string(),
});

export type Answer = z.infer<typeof AnswerSchema>;
