import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";

import { RoleProvider } from "@/components/providers/role-provider";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
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
      <body className={`${manrope.variable} ${ibmPlexMono.variable}`}>
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
