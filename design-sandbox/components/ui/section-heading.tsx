type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
}: SectionHeadingProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-2xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}
