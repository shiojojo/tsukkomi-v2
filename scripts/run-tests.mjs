#!/usr/bin/env node
import { AnswerSchema } from '../app/lib/schemas/answer.ts';
import { CommentSchema } from '../app/lib/schemas/comment.ts';
import { FavoriteSchema } from '../app/lib/schemas/favorite.ts';
import { IdentitySchema } from '../app/lib/schemas/identity.ts';
import { TopicSchema } from '../app/lib/schemas/topic.ts';
import { UserSchema } from '../app/lib/schemas/user.ts';
import { LineSyncTimestampSchema } from '../app/lib/schemas/line-sync.ts';

function expect(cond, msg) {
  if (!cond) {
    console.error('TEST FAILED:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
}

function expectThrows(fn, msg) {
  try {
    fn();
    console.error('TEST FAILED: Expected to throw but did not:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  } catch (err) {
    // Expected
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

  // Answer: error cases
  expectThrows(
    () => AnswerSchema.parse({ ...a, text: '' }),
    'AnswerSchema should reject empty text'
  );
  expectThrows(
    () => AnswerSchema.parse({ ...a, text: 'a'.repeat(1001) }),
    'AnswerSchema should reject text over 1000 chars'
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

  // Comment: error cases
  expectThrows(
    () => CommentSchema.parse({ ...c, text: '' }),
    'CommentSchema should reject empty text'
  );
  expectThrows(
    () => CommentSchema.parse({ ...c, text: 'a'.repeat(501) }),
    'CommentSchema should reject text over 500 chars'
  );

  // Favorite: basic validation
  const f = {
    answerId: 123,
    profileId: '550e8400-e29b-41d4-a716-446655440000',
  };
  const parsedF = FavoriteSchema.parse(f);
  expect(
    parsedF.answerId === 123,
    'FavoriteSchema should accept valid answerId'
  );
  expect(
    parsedF.profileId === f.profileId,
    'FavoriteSchema should accept valid profileId'
  );

  // Favorite: error cases
  expectThrows(
    () => FavoriteSchema.parse({ ...f, answerId: -1 }),
    'FavoriteSchema should reject negative answerId'
  );
  expectThrows(
    () => FavoriteSchema.parse({ ...f, profileId: 'invalid-uuid' }),
    'FavoriteSchema should reject invalid UUID'
  );

  // Identity: basic validation
  const i = {
    id: 'id-123',
    parentId: null,
    name: 'Test User',
    line_id: 'line-456',
    created_at: new Date().toISOString(),
  };
  const parsedI = IdentitySchema.parse(i);
  expect(
    parsedI.name === 'Test User',
    'IdentitySchema should accept valid name'
  );

  // Identity: error cases
  expectThrows(
    () => IdentitySchema.parse({ ...i, name: '' }),
    'IdentitySchema should reject empty name'
  );

  // Topic: basic validation
  const t = {
    id: 'topic-uuid',
    title: 'Test Topic',
    created_at: new Date().toISOString(),
    image: 'https://example.com/image.jpg',
  };
  const parsedT = TopicSchema.parse(t);
  expect(
    parsedT.title === 'Test Topic',
    'TopicSchema should accept valid title'
  );

  // Topic: error cases
  expectThrows(
    () => TopicSchema.parse({ ...t, title: '' }),
    'TopicSchema should reject empty title'
  );
  expectThrows(
    () => TopicSchema.parse({ ...t, title: 'a'.repeat(201) }),
    'TopicSchema should reject title over 200 chars'
  );
  expectThrows(
    () => TopicSchema.parse({ ...t, image: 'not-a-url' }),
    'TopicSchema should reject invalid URL'
  );

  // User: basic validation
  const u = {
    id: 'user-123',
    name: 'User Name',
    line_id: 'line-789',
    subUsers: [{ id: 'sub-1', name: 'Sub User', line_id: 'sub-line' }],
  };
  const parsedU = UserSchema.parse(u);
  expect(parsedU.name === 'User Name', 'UserSchema should accept valid name');

  // User: error cases
  expectThrows(
    () => UserSchema.parse({ ...u, name: '' }),
    'UserSchema should reject empty name'
  );

  // LineSyncTimestamp: basic validation
  const ts = LineSyncTimestampSchema.parse(new Date('2023-01-01T00:00:00Z'));
  expect(
    ts === '2023-01-01T00:00:00.000Z',
    'LineSyncTimestampSchema should normalize to ISO string'
  );

  // LineSyncTimestamp: error cases
  expectThrows(
    () => LineSyncTimestampSchema.parse('invalid-date'),
    'LineSyncTimestampSchema should reject invalid date'
  );

  console.log('All schema compatibility tests passed');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
