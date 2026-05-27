import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
  src?: string;
};

export function BrandLogo({ compact = false, className, src = "/it_solutions_worldwide_logo_transparent.png" }: BrandLogoProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden",
          className,
        )}
      >
        <Image
          src={src}
          alt="IT Solutions Worldwide logo"
          fill
          className="object-contain opacity-[0.96] mix-blend-screen"
          sizes="96px"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <div className="relative flex h-[260px] w-full max-w-[980px] shrink-0 items-center justify-center overflow-hidden">
        <Image
          src={src}
          alt="IT Solutions Worldwide logo"
          fill
          className="scale-[2.44] object-contain object-center opacity-[0.98] mix-blend-screen"
          sizes="980px"
        />
      </div>
    </div>
  );
}
