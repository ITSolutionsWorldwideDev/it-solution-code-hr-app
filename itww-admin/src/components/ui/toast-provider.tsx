// packages/ui/src/toast-provider.tsx
"use client";

import * as React from "react";
// import type { ToastPayload, ToastType } from "@acme/types";
// import { ToastContainer } from "./toast";
import { ToastContainer } from "@/components/ui/toast";

interface ToastContextValue {
  showToast: (type: any, message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState([]);

  const showToast = (type: any, message: string) => {
    const id = Date.now();

    setToasts((prev): any => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev: any) => prev.filter((t:any) => t.id !== id));
    }, 9000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}
  export function useToast() {
    const ctx = React.useContext(ToastContext);
    if (!ctx) {
      throw new Error("useToast must be used inside ToastProvider");
    }
    return ctx;
  }

