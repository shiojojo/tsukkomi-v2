import { z } from 'zod';

const answerId = z.coerce.number().int().positive();
const profileId = z.string().uuid();

export const FavoriteActionSchema = z.object({
  answerId,
  profileId,
});

export const VoteActionSchema = z.object({
  answerId,
  userId: profileId,
  level: z.coerce.number().pipe(
    z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  ),
});

export const CommentActionSchema = z.object({
  answerId,
  profileId,
  text: z.string().trim().min(1).max(500),
});