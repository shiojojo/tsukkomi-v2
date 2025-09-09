import { mockAnswers } from '../mock/answers';
import { mockTopics } from '../mock/topics';
import { AnswerSchema } from '~/lib/schemas/answer';
import { TopicSchema } from '~/lib/schemas/topic';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';

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

/**
 * getTopics
 * Intent: return the list of Topics available in the app.
 * Contract: returns Topic[] sorted by id asc.
 * Environment:
 *  - dev: returns copy of mockTopics
 *  - prod: not implemented
 */
export async function getTopics(): Promise<Topic[]> {
  if (isDev) {
    const copy = [...mockTopics];
    // Sort topics by created_at desc when available. Fallback to id-based ordering.
    copy.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return a.created_at < b.created_at ? 1 : -1;
      }
      const an = Number(a.id as any);
      const bn = Number(b.id as any);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return bn - an;
      return String(b.id) > String(a.id) ? 1 : -1;
    });
    return copy.map((t) => TopicSchema.parse(t));
  }
  throw new Error('getTopics: production not implemented');
}

/**
 * getTopic
 * Intent: return a single Topic by id (string|number). Returns undefined when not found.
 */
export async function getTopic(id: string | number): Promise<Topic | undefined> {
  const topics = await getTopics();
  return topics.find((t) => String(t.id) === String(id));
}

/**
 * getAnswersByTopic
 * Intent: return answers that belong to a given topic id.
 * Contract: topicId may be string or number. Comparison coerces both sides to string.
 */
export async function getAnswersByTopic(topicId: string | number) {
  const answers = await getAnswers();
  return answers.filter((a) => a.topicId != null && String(a.topicId) === String(topicId));
}

/**
 * voteAnswer
 * Intent: record a three-level vote for an answer.
 * Contract: accepts answerId and level (1|2|3). Returns the updated Answer.
 * Environment: dev mutates in-memory mockAnswers and returns the parsed Answer. prod: not implemented.
 */
export async function voteAnswer({
  answerId,
  level,
  previousLevel,
}: {
  answerId: number;
  level: 1 | 2 | 3;
  previousLevel?: number | null;
}): Promise<Answer> {
  if (!isDev) {
    throw new Error('voteAnswer: production not implemented');
  }

  const idx = mockAnswers.findIndex((a) => a.id === answerId);
  if (idx === -1) throw new Error('Answer not found');

  const ans = mockAnswers[idx];
  // ensure votes object exists
  ans.votes = ans.votes ?? { level1: 0, level2: 0, level3: 0 };

  // If previousLevel provided and different, decrement it (guard to non-negative)
  if (previousLevel && [1, 2, 3].includes(previousLevel)) {
    if (previousLevel === 1) ans.votes.level1 = Math.max(0, (ans.votes.level1 || 0) - 1);
    else if (previousLevel === 2) ans.votes.level2 = Math.max(0, (ans.votes.level2 || 0) - 1);
    else if (previousLevel === 3) ans.votes.level3 = Math.max(0, (ans.votes.level3 || 0) - 1);
  }

  // Add the new vote
  if (level === 1) ans.votes.level1 = (ans.votes.level1 || 0) + 1;
  else if (level === 2) ans.votes.level2 = (ans.votes.level2 || 0) + 1;
  else if (level === 3) ans.votes.level3 = (ans.votes.level3 || 0) + 1;

  // return validated copy
  return AnswerSchema.parse({ ...ans });
}
