import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-[140px] w-full rounded-[18px] border border-white/10 bg-[#10161c] px-4 py-3 text-[0.98rem] text-[#edf4fa] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] outline-none transition placeholder:text-[#76889a] focus:border-[#63e7ff]/35 focus:bg-[#182028]",
        className,
      )}
      {...props}
    />
  );
}
