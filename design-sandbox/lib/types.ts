import { LucideIcon } from "lucide-react";

export type Kpi = {
  label: string;
  value: string;
  delta: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "sky" | "slate";
};

export type ActivityItem = {
  id: string;
  title: string;
  status: string;
  timestamp: string;
  candidateName: string;
  candidateRole: string;
  candidateInitials: string;
};

export type QuickAction = {
  title: string;
  description: string;
  buttonLabel: string;
  icon: LucideIcon;
  href: string;
};

export type VacancyHighlight = {
  title: string;
  value: string;
  description: string;
};

export type DashboardData = {
  title: string;
  description: string;
  kpis: Kpi[];
  recentActivity: ActivityItem[];
  quickActions: QuickAction[];
  vacancyHighlights: VacancyHighlight[];
};
