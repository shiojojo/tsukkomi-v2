import { mockAnswers } from '../mock/answers';
import { AnswerSchema } from './schemas/answer';
import type { Answer } from './schemas/answer';

const isDev = import.meta.env.DEV;

/**
 * getAnswers
 * Intent: /routes should call this to retrieve 大喜利の回答一覧.
 * Contract: returns Answer[] sorted by created_at desc.
 * Environment:
 *  - dev: returns a copied, sorted array from mockAnswers
 *  - prod: Not implemented in this scaffold; implement Supabase client in app/lib/supabase.ts and update this file.
 * Errors: zod parsing errors will throw; prod will throw an Error until supabase is wired.
 */
export async function getAnswers(): Promise<Answer[]> {
  if (isDev) {
    // copy to avoid mutating mock
    const copy = [...mockAnswers];
    copy.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    // validate shape
    return copy.map((c) => AnswerSchema.parse(c));
  }

  // Production path: the project currently doesn't have a Supabase client scaffolded here.
  // Follow project conventions: create app/lib/supabase.ts and call supabase.from('answers')...
  throw new Error('getAnswers: production not implemented. Add app/lib/supabase.ts and implement DB fetch.');
}
