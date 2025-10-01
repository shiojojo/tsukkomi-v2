import { describe, it, expect } from 'vitest';
import { AnswerSchema } from '~/lib/schemas/answer';
import { CommentSchema } from '~/lib/schemas/comment';
import { FavoriteSchema } from '~/lib/schemas/favorite';
import { IdentitySchema } from '~/lib/schemas/identity';
import { TopicSchema } from '~/lib/schemas/topic';
import { UserSchema } from '~/lib/schemas/user';
import { LineSyncTimestampSchema } from '~/lib/schemas/line-sync';

describe('Schemas', () => {
  describe('AnswerSchema', () => {
    const validAnswer = {
      id: 1,
      text: 'x',
      profileId: 'uuid-123',
      created_at: new Date().toISOString(),
    };

    it('should accept valid answer', () => {
      const parsed = AnswerSchema.parse(validAnswer);
      expect(parsed.profileId).toBe('uuid-123');
    });

    it('should reject empty text', () => {
      expect(() => AnswerSchema.parse({ ...validAnswer, text: '' })).toThrow();
    });

    it('should reject text over 1000 chars', () => {
      expect(() => AnswerSchema.parse({ ...validAnswer, text: 'a'.repeat(1001) })).toThrow();
    });
  });

  describe('CommentSchema', () => {
    const validComment = {
      id: 1,
      answerId: 1,
      text: 'c',
      profileId: 'uuid-xyz',
      created_at: new Date().toISOString(),
    };

    it('should accept valid comment', () => {
      const parsed = CommentSchema.parse(validComment);
      expect(parsed.profileId).toBe('uuid-xyz');
    });

    it('should reject empty text', () => {
      expect(() => CommentSchema.parse({ ...validComment, text: '' })).toThrow();
    });

    it('should reject text over 500 chars', () => {
      expect(() => CommentSchema.parse({ ...validComment, text: 'a'.repeat(501) })).toThrow();
    });
  });

  describe('FavoriteSchema', () => {
    const validFavorite = {
      answerId: 123,
      profileId: '550e8400-e29b-41d4-a716-446655440000',
    };

    it('should accept valid favorite', () => {
      const parsed = FavoriteSchema.parse(validFavorite);
      expect(parsed.answerId).toBe(123);
      expect(parsed.profileId).toBe(validFavorite.profileId);
    });

    it('should reject negative answerId', () => {
      expect(() => FavoriteSchema.parse({ ...validFavorite, answerId: -1 })).toThrow();
    });

    it('should reject invalid UUID', () => {
      expect(() => FavoriteSchema.parse({ ...validFavorite, profileId: 'invalid-uuid' })).toThrow();
    });
  });

  describe('IdentitySchema', () => {
    const validIdentity = {
      id: 'id-123',
      parentId: null,
      name: 'Test User',
      line_id: 'line-456',
      created_at: new Date().toISOString(),
    };

    it('should accept valid identity', () => {
      const parsed = IdentitySchema.parse(validIdentity);
      expect(parsed.name).toBe('Test User');
    });

    it('should reject empty name', () => {
      expect(() => IdentitySchema.parse({ ...validIdentity, name: '' })).toThrow();
    });
  });

  describe('TopicSchema', () => {
    const validTopic = {
      id: 'topic-uuid',
      title: 'Test Topic',
      created_at: new Date().toISOString(),
      image: 'https://example.com/image.jpg',
    };

    it('should accept valid topic', () => {
      const parsed = TopicSchema.parse(validTopic);
      expect(parsed.title).toBe('Test Topic');
    });

    it('should reject empty title', () => {
      expect(() => TopicSchema.parse({ ...validTopic, title: '' })).toThrow();
    });

    it('should reject title over 200 chars', () => {
      expect(() => TopicSchema.parse({ ...validTopic, title: 'a'.repeat(201) })).toThrow();
    });

    it('should reject invalid URL', () => {
      expect(() => TopicSchema.parse({ ...validTopic, image: 'not-a-url' })).toThrow();
    });
  });

  describe('UserSchema', () => {
    const validUser = {
      id: 'user-123',
      name: 'User Name',
      line_id: 'line-789',
      subUsers: [{ id: 'sub-1', name: 'Sub User', line_id: 'sub-line' }],
    };

    it('should accept valid user', () => {
      const parsed = UserSchema.parse(validUser);
      expect(parsed.name).toBe('User Name');
    });

    it('should reject empty name', () => {
      expect(() => UserSchema.parse({ ...validUser, name: '' })).toThrow();
    });
  });

  describe('LineSyncTimestampSchema', () => {
    it('should normalize to ISO string', () => {
      const parsed = LineSyncTimestampSchema.parse(new Date('2023-01-01T00:00:00Z'));
      expect(parsed).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should reject invalid date', () => {
      expect(() => LineSyncTimestampSchema.parse('invalid-date')).toThrow();
    });
  });
});