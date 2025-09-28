const { z } = require('zod');

function expect(cond, msg) {
  if (!cond) {
    console.error('TEST FAILED:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
}

const AnswerSchema = z.object({
  id: z.number(),
  text: z.string().min(1).max(1000),
  profileId: z.string().optional(),
  topicId: z.union([z.string(), z.number()]).optional(),
  created_at: z.string(),
});

const CommentSchema = z.object({
  id: z.number(),
  answerId: z.union([z.number(), z.string()]),
  text: z.string().min(1).max(500),
  profileId: z.string().optional(),
  created_at: z.string(),
});

(function run() {
  const a = {
    id: 1,
    text: 'x',
    profileId: 'uuid-123',
    created_at: new Date().toISOString(),
  };
  const parsedA = AnswerSchema.parse(a);
  expect(
    parsedA.profileId === 'uuid-123',
    'AnswerSchema should accept profileId'
  );

  const c = {
    id: 1,
    answerId: 1,
    text: 'c',
    profileId: 'uuid-xyz',
    created_at: new Date().toISOString(),
  };
  const parsedC = CommentSchema.parse(c);
  expect(
    parsedC.profileId === 'uuid-xyz',
    'CommentSchema should accept profileId'
  );

  console.log('Schema compatibility tests passed');
})();
