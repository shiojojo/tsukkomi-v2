import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  // optional subUsers: array of lightweight identities that can act on behalf of the parent user
  subUsers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1),
      })
    )
    .optional(),
});

export type User = z.infer<typeof UserSchema>;
export type SubUser = { id: string; name: string };

// Input schema for creating a sub-user
export const SubUserCreateSchema = z.object({
  parentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  line_id: z.string().optional(),
});
export type SubUserCreate = z.infer<typeof SubUserCreateSchema>;

export const SubUserRemoveSchema = z.object({
  parentId: z.string().uuid(),
  subId: z.string().uuid(),
});
export type SubUserRemove = z.infer<typeof SubUserRemoveSchema>;
