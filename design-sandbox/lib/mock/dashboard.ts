import {
  BriefcaseBusiness,
  CalendarCheck2,
  FilePlus2,
  GitPullRequestArrow,
  Landmark,
  Microscope,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { DashboardData } from "@/lib/types";
import type { AppRole } from "@/lib/session";

const hrDashboard: DashboardData = {
    title: "HR Hiring Workspace",
    description:
      "Track intake, vacancy readiness, shortlist quality, and the next HR decisions across the recruitment flow.",
    kpis: [
      {
        label: "Top Ranked",
        value: "10",
        delta: "Ready for HR review",
        icon: Users,
        tone: "blue",
      },
      {
        label: "Active Vacancies",
        value: "23",
        delta: "+6 open this week",
        icon: BriefcaseBusiness,
        tone: "sky",
      },
      {
        label: "Shortlisted",
        value: "18",
        delta: "Awaiting HR decisions",
        icon: GitPullRequestArrow,
        tone: "slate",
      },
      {
        label: "Approved To Technical",
        value: "12",
        delta: "+4 today",
        icon: ShieldCheck,
        tone: "green",
      },
    ],
    recentActivity: [
      {
        id: "activity-1",
        title: "Top-ranked shortlist prepared for Backend Engineer",
        status: "Shortlist",
        timestamp: "2 hours ago",
        candidateName: "Mark Johnson",
        candidateRole: "Awaiting HR decision",
        candidateInitials: "MJ",
      },
      {
        id: "activity-2",
        title: "CV parsing completed for Data Scientist role",
        status: "Ranking",
        timestamp: "5 hours ago",
        candidateName: "Sarah Lee",
        candidateRole: "Top 10 shortlist",
        candidateInitials: "SL",
      },
      {
        id: "activity-3",
        title: "HR approved candidate for technical review",
        status: "HR Approval",
        timestamp: "1 day ago",
        candidateName: "Emily Watson",
        candidateRole: "Sent to Technical",
        candidateInitials: "EW",
      },
      {
        id: "activity-4",
        title: "New applicants linked to Senior Backend Engineer",
        status: "Applied",
        timestamp: "1 day ago",
        candidateName: "James Miller",
        candidateRole: "Ranking queue",
        candidateInitials: "JM",
      },
      {
        id: "activity-5",
        title: "Vacancy published to sourcing channels",
        status: "Vacancy",
        timestamp: "2 days ago",
        candidateName: "Lisa Wong",
        candidateRole: "Sourcing active",
        candidateInitials: "LW",
      },
    ],
    quickActions: [
      {
        title: "Create Hiring Request",
        description: "Open a new hiring request and route it into approval.",
        buttonLabel: "Create Hiring Request",
        icon: FilePlus2,
        href: "/hiring-requests",
      },
      {
        title: "View Vacancies",
        description: "Review active openings and sourcing readiness.",
        buttonLabel: "View Vacancies",
        icon: BriefcaseBusiness,
        href: "/vacancies",
      },
      {
        title: "View Candidates",
        description: "Inspect parsed resumes, rankings, and shortlist decisions.",
        buttonLabel: "Open Candidates",
        icon: Users,
        href: "/candidates",
      },
    ],
    vacancyHighlights: [
      {
        title: "Planning",
        value: "HR Decision Queue",
        description: "Keep the top candidates moving from shortlist into technical review without losing status visibility.",
      },
      {
        title: "Shortlist confidence",
        value: "High",
        description: "AI ranking and recruiter review are aligned on the current top-candidate pool.",
      },
      {
        title: "Next handoff",
        value: "Technical Review",
        description: "HR-approved candidates flow directly into the technical workspace.",
      },
    ],
  };

const technicalDashboard: DashboardData = {
  title: "Technical Review Workspace",
  description:
    "Focus on HR-approved candidates, technical interviews, reviewer feedback, and promotion into management review.",
  kpis: [
    { label: "Awaiting Technical Review", value: "12", delta: "+4 this week", icon: Microscope, tone: "blue" },
    { label: "Technical Interviews", value: "7", delta: "3 scheduled today", icon: CalendarCheck2, tone: "sky" },
    { label: "Approved to Management", value: "5", delta: "+2 since Monday", icon: GitPullRequestArrow, tone: "slate" },
    { label: "Average Technical Score", value: "8.6", delta: "Across active rounds", icon: ShieldCheck, tone: "green" },
  ],
  recentActivity: [
    {
      id: "tech-1",
      title: "Backend interview feedback submitted",
      status: "Technical Round",
      timestamp: "45 minutes ago",
      candidateName: "Mark Johnson",
      candidateRole: "Ready for recommendation",
      candidateInitials: "MJ",
    },
    {
      id: "tech-2",
      title: "Frontend technical interview scheduled",
      status: "Interview",
      timestamp: "2 hours ago",
      candidateName: "Lisa Wong",
      candidateRole: "Technical review",
      candidateInitials: "LW",
    },
    {
      id: "tech-3",
      title: "Data Scientist coding assessment reviewed",
      status: "Evaluation",
      timestamp: "5 hours ago",
      candidateName: "Emily Watson",
      candidateRole: "Pass recommendation",
      candidateInitials: "EW",
    },
  ],
  quickActions: [
    {
      title: "Review Technical Round",
      description: "Open technical candidates and submit interview feedback.",
      buttonLabel: "Review Technical Round",
      icon: Microscope,
      href: "/pipeline",
    },
    {
      title: "Schedule Interviews",
      description: "Coordinate technical sessions for approved candidates.",
      buttonLabel: "Schedule Interviews",
      icon: CalendarCheck2,
      href: "/pipeline",
    },
    {
      title: "View Vacancies",
      description: "Keep role requirements visible while reviewing candidates.",
      buttonLabel: "View Vacancies",
      icon: BriefcaseBusiness,
      href: "/vacancies",
    },
  ],
  vacancyHighlights: [
    {
      title: "Technical Focus",
      value: "Interview Throughput",
      description: "Track technical feedback speed and the handoff into management review.",
    },
    {
      title: "Feedback consistency",
      value: "Strong",
      description: "Interview notes are arriving within the expected 24-hour target window.",
    },
  ],
};

const managerDashboard: DashboardData = {
  title: "Management Selection Workspace",
  description:
    "Review technically approved finalists, make final selections, and control offer progress.",
  kpis: [
    { label: "Awaiting Management Review", value: "6", delta: "2 today", icon: Landmark, tone: "blue" },
    { label: "Offers Pending", value: "3", delta: "1 ready to send", icon: Send, tone: "sky" },
    { label: "Selected This Month", value: "9", delta: "+3 vs last month", icon: ShieldCheck, tone: "green" },
    { label: "Final Decisions", value: "4", delta: "Awaiting management response", icon: FilePlus2, tone: "slate" },
  ],
  recentActivity: [
    {
      id: "mgr-1",
      title: "Final interview completed for Senior Backend Engineer",
      status: "Management Round",
      timestamp: "1 hour ago",
      candidateName: "Sarah Lee",
      candidateRole: "Ready for selection",
      candidateInitials: "SL",
    },
    {
      id: "mgr-2",
      title: "Offer package prepared for UX Researcher",
      status: "Offer",
      timestamp: "4 hours ago",
      candidateName: "Lisa Wong",
      candidateRole: "Offer draft",
      candidateInitials: "LW",
    },
    {
      id: "mgr-3",
      title: "Management review pending for Data Scientist finalist",
      status: "Management Review",
      timestamp: "Today",
      candidateName: "James Miller",
      candidateRole: "Final decision pending",
      candidateInitials: "JM",
    },
  ],
  quickActions: [
    {
      title: "Review Finalists",
      description: "Inspect management-round candidates and make final decisions.",
      buttonLabel: "Review Finalists",
      icon: FilePlus2,
      href: "/pipeline",
    },
    {
      title: "Track Offers",
      description: "Monitor offer progress, acceptances, and close-outs.",
      buttonLabel: "Track Offers",
      icon: Landmark,
      href: "/pipeline",
    },
    {
      title: "View Vacancies",
      description: "Keep active roles and finalist context visible during final selection.",
      buttonLabel: "Open Vacancies",
      icon: BriefcaseBusiness,
      href: "/vacancies",
    },
  ],
  vacancyHighlights: [
    {
      title: "Decision Focus",
      value: "Final Selection",
      description: "Keep management decisions, offers, and close-out actions in one place.",
    },
    {
      title: "Offer velocity",
      value: "2.1 days",
      description: "Average time from manager selection to offer sent.",
    },
  ],
};

const adminDashboard: DashboardData = {
  ...hrDashboard,
  title: "Platform Admin Overview",
  description:
    "Observe the full automated recruitment workflow across intake, approvals, screening, and hiring.",
};

export function getDashboardData(role: AppRole): DashboardData {
  switch (role) {
    case "Technical":
      return technicalDashboard;
    case "Manager":
      return managerDashboard;
    case "Admin":
      return adminDashboard;
    case "HR":
    default:
      return hrDashboard;
  }
}
