import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

export type User = z.infer<typeof UserSchema>;
