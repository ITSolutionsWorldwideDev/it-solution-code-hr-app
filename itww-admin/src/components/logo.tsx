import darkLogo from "/images/logo/logo-dark.png";
import logo from "/images/logo/logo.png";
import Image from "next/image";

export function Logo() {
  return (
    <div className="relative mx-10 h-12">
      <Image
        src={"/images/logo/logo.png"}
        fill
        className="object-contain  dark:hidden"
        alt="ITWW-Admin logo"
        priority
        quality={100}
      />

      <Image
        src={"/images/logo/logo-dark.png"}
        fill
        className="object-contain  hidden dark:block"
        alt="ITWW-Admin logo"
        priority
        quality={100}
      />
    </div>
  );
}
