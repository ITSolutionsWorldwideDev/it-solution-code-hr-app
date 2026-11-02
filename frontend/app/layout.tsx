import type { Metadata } from "next";

import { AppScaleProvider } from "@/components/providers/app-scale-provider";
import { RoleProvider } from "@/components/providers/role-provider";

import "./globals.css";

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
      <body className="font-sans antialiased">
        <RoleProvider>
          <AppScaleProvider>{children}</AppScaleProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
