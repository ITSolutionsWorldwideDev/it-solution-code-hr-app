import Link from "next/link";
import {
  DribbleIcon,
  FacebookIcon,
  GitHubIcon,
  LinkedInIcon,
  XIcon,
} from "./icons";

const ACCOUNTS = [
  {
    platform: "Facebook",
    url: "https://www.facebook.com/itsolutionsww/",
    Icon: FacebookIcon,
  },
  {
    platform: "X",
    url: "https://x.com/ITSolutionsBV",
    Icon: XIcon,
  },
  {
    platform: "LinkedIn",
    url: "https://nl.linkedin.com/company/it-solutions-worldwide-bv",
    Icon: LinkedInIcon,
  },
  // {
  //   platform: "Instagram",
  //   url: "https://www.instagram.com/itsolutionsworldwide/",
  //   Icon: GitHubIcon,
  // },
  {
    platform: "GitHub",
    url: "https://github.com/ITSolutionsWorldwideDev",
    Icon: GitHubIcon,
  },
];

export function SocialAccounts() {
  return (
    <div className="mt-4.5">
      <h4 className="mb-3.5 font-medium text-dark dark:text-white">
        Follow us on
      </h4>
      <div className="flex items-center justify-center gap-3.5">
        {ACCOUNTS.map(({ Icon, ...item }) => (
          <Link
            key={item.platform}
            href={item.url}
            className="hover:text-primary"
          >
            <span className="sr-only">View {item.platform} Account</span>

            <Icon />
          </Link>
        ))}
      </div>
    </div>
  );
}
