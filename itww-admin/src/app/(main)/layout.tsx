// src/app/(main)/layout.tsx
import "@/css/satoshi.css";
import "@/css/style.css";

import { Sidebar } from "@/components/Layouts/sidebar";
import {ToastProvider} from "@/components/ui/toast-provider";
import "flatpickr/dist/flatpickr.min.css";

import { Header } from "@/components/Layouts/header";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "../providers";


export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <NextTopLoader color="#5750F1" showSpinner={false} />

          <div className="flex min-h-screen">
            <Sidebar />

            <div className="w-full bg-gray-2 dark:bg-[#020d1a]">
              <Header />

              <main className="isolate mx-auto w-full max-w-screen-2xl overflow-hidden p-4 md:p-6 2xl:p-10">
                <ToastProvider >
                {children}
                </ToastProvider>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}


export const metadata: Metadata = {
  title: {
    template: "%s | IT Solutions Worldwide - Admin Panel",
    default: "IT Solutions Worldwide - Admin Panel",
  },
  description:
    "IT Solutions Worldwide - Admin Panel",
  icons: {
    icon: "/images/favicon-96x96.png", // or /favicon.png, /icon.svg
    shortcut: "/images/favicon-96x96.png",
    apple: "/images/favicon-96x96.png",
  },
};
