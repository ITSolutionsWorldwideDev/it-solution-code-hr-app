import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Inter, JetBrains_Mono } from "next/font/google";

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

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-hanken-grotesk",
});

export const metadata: Metadata = {
  title: "Talent Genie",
  description: "AI-powered recruitment workspace for modern hiring operations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetBrainsMono.variable} ${hankenGrotesk.variable}`}>
        <RoleProvider>
          <AppScaleProvider>{children}</AppScaleProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
