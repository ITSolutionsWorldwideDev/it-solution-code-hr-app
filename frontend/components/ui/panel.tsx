import { cn } from "@/lib/utils";

type PanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function Panel({ children, className }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(19,23,22,0.98)_0%,rgba(28,32,31,0.94)_100%)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.26)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
