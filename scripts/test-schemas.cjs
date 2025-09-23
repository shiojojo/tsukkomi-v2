const { z } = require('zod');

function expect(cond, msg) {
  if (!cond) {
    console.error('TEST FAILED:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
}

const AnswerSchema = z
  .object({
    id: z.number(),
    text: z.string().min(1).max(1000),
    author: z.string().optional(),
    profileId: z.string().optional(),
    authorId: z.string().optional(),
    topicId: z.union([z.string(), z.number()]).optional(),
    created_at: z.string(),
  })
  .transform(a => ({ ...a, profileId: a.profileId ?? a.authorId }));

const CommentSchema = z
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

(function run() {
  const a = {
    id: 1,
    text: 'x',
    authorId: 'uuid-123',
    created_at: new Date().toISOString(),
  };
  const parsedA = AnswerSchema.parse(a);
  expect(
    parsedA.profileId === 'uuid-123',
    'AnswerSchema should map authorId -> profileId'
  );

  const c = {
    id: 1,
    answerId: 1,
    text: 'c',
    authorId: 'uuid-xyz',
    created_at: new Date().toISOString(),
  };
  const parsedC = CommentSchema.parse(c);
  expect(
    parsedC.profileId === 'uuid-xyz',
    'CommentSchema should map authorId -> profileId'
  );

  console.log('Schema compatibility tests passed');
})();
