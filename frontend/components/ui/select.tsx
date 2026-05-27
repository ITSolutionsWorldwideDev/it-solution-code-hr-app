import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-12 w-full appearance-none rounded-[18px] border border-white/10 bg-[#10161c] px-4 text-[0.98rem] text-[#edf4fa] outline-none transition focus:border-[#63e7ff]/35 focus:bg-[#182028]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
