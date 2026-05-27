import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return (
    compact ? (
      <div className={cn("relative h-[76px] w-[76px] overflow-hidden bg-[#0a0c10]", className)}>
        <Image
          src="/it-solutions-new.png"
          alt="IT Solutions Worldwide icon"
          fill
          priority
          className="object-contain opacity-90 mix-blend-lighten [filter:brightness(1.2)_contrast(1.5)]"
          sizes="60px"
        />
      </div>
    ) : (
      <div className={cn("relative h-[88px] w-[398px] overflow-hidden bg-[#0a0c10]", className)}>
        <Image
          src="/it-solutions-new.png"
          alt="IT Solutions Worldwide"
          fill
          priority
          className="object-contain object-left opacity-90 mix-blend-lighten [filter:brightness(1.2)_contrast(1.5)]"
          sizes="300px"
        />
      </div>
    )
  );
}
