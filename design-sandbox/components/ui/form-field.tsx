import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

export function FormField({ label, hint, children, className }: FormFieldProps) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="block text-sm font-semibold text-[#dbe8f2]">{label}</span>
      {children}
      {hint ? <span className="block text-sm text-[#93a6b6]">{hint}</span> : null}
    </label>
  );
}
