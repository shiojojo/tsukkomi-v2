import { z } from 'zod';

/**
 * Identity: 統合ユーザー (メイン or サブ)。parentId が null の行がメイン。parentId がメイン id の行がサブ。
 */
export const IdentitySchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  name: z.string().min(1),
  line_id: z.string().optional().nullable(),
  created_at: z.string().optional(),
});
export type Identity = z.infer<typeof IdentitySchema>;

export const IdentityWithChildrenSchema = IdentitySchema.extend({
  children: z.array(IdentitySchema).optional(),
});
export type IdentityWithChildren = z.infer<typeof IdentityWithChildrenSchema>;