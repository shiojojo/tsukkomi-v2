import { z } from 'zod';

/**
 * 概要: トピック (Topic) の入出力スキーマ。
 * Intent: DB / mock データと UI の間で同じ型を保証する。
 * Contract:
 *   - id: string | number (UUID or legacy numeric id)
 *   - title: 1..200 chars
 *   - created_at: ISO string
 *   - image: URL string OR null OR undefined (画像あり/なしを許容)
 * Environment:
 *   - dev: mock data may use numeric ids and omit image
 *   - prod: Supabase returns null for absent image -> schema must accept null
 * Errors: zod 失敗は呼び出し元で捕捉すること
 */
export const TopicSchema = z.object({
  // id can be string (UUID/slug) or number (legacy/mock). Accept both for compatibility.
  id: z.union([z.string(), z.number()]),
  title: z.string().min(1).max(200),
  created_at: z.string(),
  // image may be a URL string, undefined (not present), or null (DB returns null)
  image: z.string().url().nullable().optional(),
});

export type Topic = z.infer<typeof TopicSchema>;
