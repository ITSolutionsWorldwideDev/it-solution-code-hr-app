import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AppScaleProvider } from "@/components/providers/app-scale-provider";
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
  title: "Talent Genie",
  description: "AI-powered recruitment workspace for modern hiring operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetBrainsMono.variable}`}>
        <RoleProvider>
          <AppScaleProvider>{children}</AppScaleProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
