#!/usr/bin/env node
import { AnswerSchema } from '../app/lib/schemas/answer.js';
import { CommentSchema } from '../app/lib/schemas/comment.js';

function expect(cond, msg) {
  if (!cond) {
    console.error('TEST FAILED:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
}

async function run() {
  // Answer: when authorId present and profileId absent, transform should populate profileId
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

  // Comment: same mapping
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

  console.log('All schema compatibility tests passed');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
