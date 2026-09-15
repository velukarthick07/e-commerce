import { z } from "zod";

/**
 * PostgreSQL identifiers cannot be passed as query parameters, so the database
 * name is restricted to characters that are safe to quote into DDL.
 */
const databaseName = z
  .string()
  .trim()
  .min(1, "Database name is required")
  .max(63, "Database names are limited to 63 characters")
  .regex(
    /^[A-Za-z_][A-Za-z0-9_$]*$/,
    "Start with a letter or underscore, then letters, numbers or underscores"
  );

export const databaseSchema = z.object({
  host: z.string().trim().min(1, "Host is required").max(255),
  port: z.coerce
    .number()
    .int("Port must be a whole number")
    .min(1)
    .max(65535)
    .default(5432),
  user: z.string().trim().min(1, "User is required").max(63),
  password: z.string().max(256),
  database: databaseName,
  ssl: z.boolean().default(false),
});

export const testDatabaseSchema = z.object({
  key: z.string().trim().optional(),
  database: databaseSchema,
});

const administratorSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    phone: z.string().trim().max(20).optional().or(z.literal("")),
    // Matches the rules the Users module enforces, so the first account is
    // held to the same standard as every account created after it.
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const installSchema = z.object({
  key: z.string().trim().optional(),
  storeName: z.string().trim().min(2, "Store name is required").max(120),
  database: databaseSchema,
  administrator: administratorSchema,
});

export type DatabaseSettings = z.infer<typeof databaseSchema>;
export type InstallRequest = z.infer<typeof installSchema>;
