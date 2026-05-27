import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[0.98rem] text-[#edf4fa] outline-none transition placeholder:text-[#7f95a7] focus:border-[#7eb9df]/35",
        className
      )}
      {...props}
    />
  );
}
