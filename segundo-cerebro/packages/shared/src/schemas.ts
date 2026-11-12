import { z } from 'zod';

export const passwordSchema = z.string().min(10, 'A senha precisa ter ao menos 10 caracteres');
export const emailSchema = z.string().trim().toLowerCase().email();

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export type LoginInput = z.infer<typeof loginSchema>;

export type ApiErrorBody = { error: { code: string; message: string } };
