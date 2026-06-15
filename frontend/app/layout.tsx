import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { RoleProvider } from "@/components/providers/role-provider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "RecruitFlow AI",
  description: "Modern recruitment dashboard for AI-assisted hiring operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetBrainsMono.variable}`}>
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
