import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Questea | Modern Task Management",
  description: "Manage your life with ease. Tasks, categories, calendar, voice & sharing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
