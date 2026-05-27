import "./globals.css";
import type { Metadata } from "next";
import { RoleProvider } from "@/components/providers/role-provider";

export const metadata: Metadata = {
  title: "IT Solutions Design Sandbox",
  description: "Standalone UI sandbox for experimenting with new frontend directions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
