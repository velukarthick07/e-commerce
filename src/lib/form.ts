import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";

/**
 * `z.coerce.*` makes a schema's input type (`unknown`) differ from its output
 * type, which react-hook-form's `Resolver` generic cannot reconcile on its own.
 * Forms are typed with the *input* shape (what the fields actually hold), so
 * this narrows the resolver to match that.
 */
export function formResolver<TInput extends FieldValues>(
  schema: Parameters<typeof zodResolver>[0]
): Resolver<TInput> {
  return zodResolver(schema) as unknown as Resolver<TInput>;
}
