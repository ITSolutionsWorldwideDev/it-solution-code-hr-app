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
        "h-12 w-full rounded-[18px] border border-white/10 bg-[#10161c] px-4 text-[0.98rem] text-[#edf4fa] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] outline-none transition placeholder:text-[#76889a] focus:border-[#63e7ff]/35 focus:bg-[#182028] file:mr-4 file:h-10 file:rounded-xl file:border-0 file:bg-[#182028] file:px-4 file:text-[0.98rem] file:font-medium file:text-[#edf4fa] hover:file:bg-[#202a34]",
        className,
      )}
      {...props}
    />
  );
});
