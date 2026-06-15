// src/components/Layouts/sidebar/data/index.ts
import * as Icons from "../icons";

export interface NavItem {
  title: string;
  url?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  items?: NavItem[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_DATA: NavSection[] = [
  {
    label: "",
    items: [
      {
        title: "Dashboard",
        icon: Icons.HomeIcon,
        url: "/",
      },
      {
        title: "Jobs Info",
        url: "/jobs-info",
        icon: Icons.Alphabet,
        items: [],
      },
      {
        title: "Applications",
        url: "/job-applications",
        icon: Icons.User,
        items: [],
      },
      {
        title: "Blogs",
        url: "/blogs",
        icon: Icons.Table,
        items: [],
      },
      {
        title: "Media",
        url: "/media",
        icon: Icons.FourCircle,
        items: [],
      },
    ],
  },
];
