#!/usr/bin/env node
import { AnswerSchema } from '../app/lib/schemas/answer.ts';
import { CommentSchema } from '../app/lib/schemas/comment.ts';

function expect(cond, msg) {
  if (!cond) {
    console.error('TEST FAILED:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
}

async function run() {
  // Answer: basic validation
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

  // Comment: basic validation
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

  console.log('All schema compatibility tests passed');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
