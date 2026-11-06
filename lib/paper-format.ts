import { z } from "zod";
export const paperFonts = [
  { name: "Times New Roman", size: 12 },
  { name: "Aptos", size: 12 },
  { name: "Calibri", size: 11 },
  { name: "Arial", size: 11 },
  { name: "Georgia", size: 11 },
  { name: "Lucida Sans Unicode", size: 10 },
  { name: "Computer Modern", size: 10 },
] as const;
export const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24] as const;
export const lineSpacings = [1, 1.15, 1.5, 2, 2.5, 3] as const;
export const paperFormatSchema = z
  .object({
    alignment: z
      .enum(["left", "center", "right", "justify"])
      .default("justify"),
    font: z
      .enum([
        "Times New Roman",
        "Aptos",
        "Calibri",
        "Arial",
        "Georgia",
        "Lucida Sans Unicode",
        "Computer Modern",
      ])
      .default("Times New Roman"),
    fontSize: z
      .number()
      .refine(
        (n) => (fontSizes as readonly number[]).includes(n),
        "Choose a supported font size.",
      )
      .default(12),
    lineSpacing: z
      .number()
      .refine(
        (n) => (lineSpacings as readonly number[]).includes(n),
        "Choose a supported line spacing.",
      )
      .default(2),
    spaceBefore: z.number().int().min(0).max(24).default(0),
    spaceAfter: z.number().int().min(0).max(24).default(0),
  })
  .strict();
export type PaperFormat = z.infer<typeof paperFormatSchema>;
export const defaultPaperFormat: PaperFormat = paperFormatSchema.parse({});
export const apaStandardFormat: PaperFormat = {
  ...defaultPaperFormat,
  alignment: "left",
};
export const followsApaLayout = (f: PaperFormat) =>
  f.alignment === "left" &&
  f.lineSpacing === 2 &&
  f.spaceBefore === 0 &&
  f.spaceAfter === 0 &&
  paperFonts.some((p) => p.name === f.font && p.size === f.fontSize);
