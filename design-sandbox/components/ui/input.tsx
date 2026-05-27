import { forwardRef } from "react";

import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-[0.98rem] text-[#edf4fa] outline-none transition placeholder:text-[#7f95a7] focus:border-[#7eb9df]/35 file:mr-4 file:h-10 file:rounded-xl file:border-0 file:bg-white/[0.06] file:px-4 file:text-[0.98rem] file:font-medium file:text-[#edf4fa] hover:file:bg-white/[0.1]",
        className
      )}
      {...props}
    />
  );
});
