import { z } from 'zod';

export const FavoriteSchema = z.object({
  answerId: z.coerce.number().int().positive(),
  profileId: z.string().uuid(),
});

export type FavoriteInput = z.infer<typeof FavoriteSchema>;
