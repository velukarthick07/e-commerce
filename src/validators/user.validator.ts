import { z } from "zod";
import { RoleName } from "@/generated/prisma/enums";
import { emailOptional, optionalFilter, paginationQuery } from "./common.validator";

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
  role: z.enum(RoleName),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true })
  .extend({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .optional()
      .or(z.literal("")),
  });

export const listUsersQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  role: optionalFilter(z.enum(RoleName)),
  isActive: optionalFilter(z.enum(["true", "false"])),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  avatarUrl: emailOptional.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
