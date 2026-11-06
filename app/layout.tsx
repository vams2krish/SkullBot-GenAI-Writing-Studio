import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SkullBot — Good writing has good bones.",
  description:
    "Your writing, with a little backbone. Paraphrase, polish, summarize, cite, and format in one thoughtful workspace.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
