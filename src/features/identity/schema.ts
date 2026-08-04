import { z } from 'zod';

export const signupDto = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});
export const loginDto = signupDto;
export const changePasswordDto = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export type SignupDto = z.infer<typeof signupDto>;
export type LoginDto = z.infer<typeof loginDto>;
export type ChangePasswordDto = z.infer<typeof changePasswordDto>;
