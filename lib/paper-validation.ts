import { z } from "zod";
import { paperFormatSchema } from "./paper-format.ts";
const field = z.string().max(500);
const citation = z.object({
  id: field,
  kind: z.enum(["Webpage", "Book", "Journal article"]),
  authors: z.string().max(5000),
  year: z.string().regex(/^(?:\d{4}[a-z]?)?$/),
  title: z.string().trim().min(1).max(5000),
  publisher: z.string().max(5000),
  url: z
    .string()
    .max(5000)
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      "Use an HTTP or HTTPS source URL.",
    ),
  volume: field,
  issue: field,
  pages: field,
});
export const paperSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(25000)
    .refine((value) => Boolean(value.trim()), "Add body text."),
  meta: z
    .object({
      kind: z.enum(["Student", "Professional"]),
      title: field.refine((value) => Boolean(value.trim())),
      author: field.refine((value) => Boolean(value.trim())),
      institution: field.refine((value) => Boolean(value.trim())),
      course: field,
      instructor: field,
      due: field,
      runningHead: z.string().max(50),
      authorNote: field,
    })
    .superRefine((meta, ctx) => {
      const required =
        meta.kind === "Student"
          ? (["course", "instructor", "due"] as const)
          : (["runningHead", "authorNote"] as const);
      for (const key of required)
        if (!meta[key].trim())
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `Complete ${key} for this paper type.`,
          });
    }),
  citations: z.array(citation).max(100),
  format: paperFormatSchema.optional(),
});
