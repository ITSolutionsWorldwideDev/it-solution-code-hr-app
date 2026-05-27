import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-12 w-full appearance-none rounded-2xl border border-white/10 bg-[#161b22] px-4 text-[0.98rem] text-[#edf4fa] outline-none transition focus:border-[#7eb9df]/35",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
