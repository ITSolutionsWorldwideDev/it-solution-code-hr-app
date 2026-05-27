export type SandboxVacancy = {
  id: string;
  title: string;
  department: string;
  status: "Open" | "On Hold" | "Closed";
  location: string;
  employmentType: string;
  experienceLevel: string;
  summary: string;
  overview: string[];
  responsibilities: string[];
  qualifications: string[];
  skills: string[];
};

export const shellNav = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Job Description", href: "/job-description" },
  { label: "Shortlisted", href: "/shortlisted" },
  { label: "Candidates", href: "/candidates" },
  { label: "Vacancies", href: "/vacancies" },
  { label: "Pipeline", href: "/pipeline" },
  { label: "Onboarding", href: "/onboarding" },
  { label: "Organogram", href: "/organogram" },
  { label: "Departments", href: "/departments" },
] as const;

export const vacancies: SandboxVacancy[] = [
  {
    id: "1",
    title: "Data Analyst",
    department: "Data",
    status: "Open",
    location: "Amsterdam / Hybrid",
    employmentType: "Full-time",
    experienceLevel: "Mid-level",
    summary: "Turn messy business reporting into clear dashboards and reliable insights.",
    overview: [
      "We are seeking a Data Analyst to turn data into actionable insights and trusted reporting across the business.",
      "You will work closely with stakeholders, improve Power BI dashboards, and support decision-making with clear reporting structures.",
    ],
    responsibilities: [
      "Build and maintain dashboards and reporting flows for finance, operations, and leadership teams.",
      "Translate business questions into analytical requirements and measurable KPI frameworks.",
      "Clean and combine data from multiple sources and monitor reporting quality.",
    ],
    qualifications: [
      "Strong Power BI and Excel experience with solid SQL foundations.",
      "Comfortable with stakeholder communication, exploratory analysis, and documenting definitions.",
      "Experience in a data analyst or reporting role.",
    ],
    skills: ["Power BI", "Excel", "SQL", "Dashboarding", "Data Cleaning", "Reporting"],
  },
  {
    id: "2",
    title: "Backend Engineer",
    department: "Engineering",
    status: "On Hold",
    location: "Rotterdam / Remote",
    employmentType: "Full-time",
    experienceLevel: "Senior",
    summary: "Design reliable APIs and backend services for AI-driven recruitment workflows.",
    overview: [
      "This role focuses on Python services, async processing, and integrations with automation tooling.",
    ],
    responsibilities: [
      "Own backend endpoints and data flows for vacancies, parsing, and approval steps.",
      "Improve reliability of integrations and internal admin tooling.",
    ],
    qualifications: [
      "Strong Python backend experience.",
      "Comfort with API design, queues, and database-backed workflows.",
    ],
    skills: ["Python", "FastAPI", "Postgres", "Integrations", "Async Jobs"],
  },
];

export const publicApplyVacancy = vacancies[0];
