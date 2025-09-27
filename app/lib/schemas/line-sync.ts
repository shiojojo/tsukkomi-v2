import { z } from 'zod';

/**
 * LineSyncTimestampSchema: Accepts ISO strings, other parsable strings, numbers (epoch), or Date instances
 * and normalizes them into ISO8601 strings. GAS 側でフォーマットが揺れるケースを吸収するために用意。
 */
export const LineSyncTimestampSchema = z
  .union([z.string().min(1), z.number(), z.date()])
  .transform(value => {
    const date = value instanceof Date ? value : new Date(value);
    return date;
  })
  .refine(date => !Number.isNaN(date.getTime()), {
    message: 'Invalid date value',
  })
  .transform(date => date.toISOString());

/** Segment: topic metadata sent from LINE GAS cron */
export const LineSyncTopicSchema = z.object({
  kind: z.literal('text').default('text'),
  title: z.string().min(1).max(300),
  createdAt: LineSyncTimestampSchema.optional(),
  sourceLabel: z.string().max(300).optional(),
});

/** Single answer row coming from LINE GAS cron */
export const LineSyncAnswerSchema = z.object({
  answerId: z.string().min(1).max(120).optional(),
  text: z.string().min(1).max(1000),
  lineUserId: z.string().min(1).max(200),
  displayName: z.string().min(1).max(120).optional(),
  groupId: z.string().min(1).max(200).optional(),
  submittedAt: LineSyncTimestampSchema.optional(),
});

/**
 * LineAnswerIngestRequestSchema: a batch payload of answers for one topic.
 * - answers length is capped (200) to avoid oversized payloads.
 * - apiVersion reserved for future breaking changes.
 */
export const LineAnswerIngestRequestSchema = z.object({
  apiVersion: z.literal(1).optional(),
  topic: LineSyncTopicSchema,
  answers: z.array(LineSyncAnswerSchema).min(1).max(200),
});

export type LineSyncTopic = z.infer<typeof LineSyncTopicSchema>;
export type LineSyncAnswer = z.infer<typeof LineSyncAnswerSchema>;
export type LineAnswerIngestRequest = z.infer<typeof LineAnswerIngestRequestSchema>;
