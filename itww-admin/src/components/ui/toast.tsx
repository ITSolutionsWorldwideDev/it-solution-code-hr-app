// packages/ui/src/toast.tsx
"use client";

// import type { ToastPayload, ToastType } from "@acme/types";
import { Toast } from "react-bootstrap";

/* const toastStyles: Record<ToastType, string> = {
  success: "bg-green-600",
  error: "bg-red-600",
  primary: "bg-blue-600",
}; */

export function ToastContainer({ toasts }:any) {
  return (
    <div className="fixed top-4 right-2 z-[9999] space-y-3">
      {toasts.map((toast:any) => (
        <Toast
          className={`colored-toast bg-${toast.type}-transparent`}
          delay={3000}
          key={toast.id}
          autohide
        >
          <Toast.Header
            closeButton
            className={`px-2 rounded-md bg-${toast.type}  text-white py-2 pl-5 pr-10 shadow-lg`}
          >
            <strong className="me-auto capitalize">{toast.type}</strong>
          </Toast.Header>
          <Toast.Body className="py-2 px-2 pl-5 pr-10 capitalize">
            {toast.message}
          </Toast.Body>
        </Toast>
      ))}
    </div>
  );
}