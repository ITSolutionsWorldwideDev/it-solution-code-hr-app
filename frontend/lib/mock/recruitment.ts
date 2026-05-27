import type {
  EmployeeHierarchyNode,
  EmployeeRecord,
  HiringRequestRecord,
  PipelineCandidateRecord,
  PipelineStage,
  VacancyRecord,
} from "@/lib/recruitment-types";

export const mockHiringRequests: HiringRequestRecord[] = [
  {
    id: "hr-001",
    jobTitle: "Senior Backend Engineer",
    department: "Engineering",
    budget: "EUR 78,000",
    requirements:
      "Strong Python, FastAPI, PostgreSQL, REST API design, and cloud deployment experience.",
    aiJobDescription:
      "Lead backend platform work across scalable recruitment systems, API integrations, and data-heavy services.",
    status: "pending",
    requestedBy: "Jacob Smith",
    createdAt: "Today",
  },
  {
    id: "hr-002",
    jobTitle: "Data Scientist",
    department: "Data",
    budget: "EUR 72,000",
    requirements:
      "Machine learning, experimentation, SQL, dashboarding, and business-facing communication.",
    aiJobDescription:
      "Own predictive hiring insights, improve candidate scoring, and support data-informed recruitment decisions.",
    status: "approved",
    requestedBy: "Sarah Lee",
    createdAt: "Yesterday",
  },
  {
    id: "hr-003",
    jobTitle: "Frontend Developer",
    department: "Product",
    budget: "EUR 64,000",
    requirements:
      "Next.js, TypeScript, component systems, dashboard UX, and cross-functional collaboration.",
    aiJobDescription:
      "Build polished hiring workflows and recruiter-facing interfaces across the product experience.",
    status: "rejected",
    requestedBy: "Emily Watson",
    createdAt: "2 days ago",
  },
];

export const mockVacancies: VacancyRecord[] = [
  {
    id: "vac-001",
    title: "Senior Backend Engineer",
    department: "Engineering",
    status: "open",
    createdAt: "2026-03-28T09:30:00Z",
    location: "Amsterdam",
    employmentType: "Full-time",
    experienceLevel: "Senior",
    description:
      "Build and maintain scalable backend services for the recruitment platform, with a focus on APIs and structured candidate data workflows.",
    requirements: [
      "Python and FastAPI",
      "PostgreSQL and data modeling",
      "API design and testing",
      "Cloud deployment experience",
    ],
    summary:
      "A high-priority platform role with strong alignment to the current AI recruitment backend roadmap.",
  },
  {
    id: "vac-002",
    title: "Data Scientist",
    department: "Data",
    status: "on_hold",
    createdAt: "2026-03-21T14:10:00Z",
    location: "Rotterdam",
    employmentType: "Full-time",
    experienceLevel: "Mid-Senior",
    description:
      "Design data products that improve hiring quality, ranking, and recruiter efficiency across the platform.",
    requirements: [
      "Machine learning",
      "SQL and experimentation",
      "Stakeholder communication",
      "Model evaluation",
    ],
    summary:
      "A strategic analytics role currently paused pending headcount review.",
  },
  {
    id: "vac-003",
    title: "UX Researcher",
    department: "Product",
    status: "closed",
    createdAt: "2026-03-10T11:45:00Z",
    location: "Remote",
    employmentType: "Contract",
    experienceLevel: "Mid",
    description:
      "Support product teams with research on recruiter workflows, candidate journeys, and dashboard usability.",
    requirements: [
      "Qualitative research",
      "Research ops",
      "Synthesis and insight communication",
      "Cross-functional planning",
    ],
    summary:
      "This opening has already been filled and is kept here as a mock closed vacancy example.",
  },
];

export const pipelineStageOrder: PipelineStage[] = [
  "hr_invite_sent",
  "hr_interview_scheduled",
  "hr_in_progress",
  "hr_passed",
  "technical_interview_scheduled",
  "technical_in_progress",
  "technical_passed",
  "management_interview_scheduled",
  "management_in_progress",
  "selected",
  "offer_sent",
  "offer_accepted",
  "offer_declined",
  "hired",
  "rejected",
];

export const pipelineStageLabels: Record<PipelineStage, string> = {
  applied: "Applied",
  ranked: "Ranked",
  shortlisted: "Shortlisted",
  hr_review: "HR Review",
  hr_invite_sent: "Waiting for approval from candidate",
  hr_interview_scheduled: "HR Interview Scheduled",
  hr_in_progress: "HR In Progress",
  hr_approved: "HR Approved",
  hr_passed: "HR Passed",
  technical_review: "Technical Review",
  technical_interview_scheduled: "Technical Interview Scheduled",
  technical_in_progress: "Technical In Progress",
  technical_approved: "Technical Approved",
  technical_passed: "Technical Passed",
  management_review: "Management Review",
  management_interview_scheduled: "Management Interview Scheduled",
  management_in_progress: "Management In Progress",
  selected: "Selected",
  offer_sent: "Offer Sent",
  offer_accepted: "Offer Accepted",
  offer_declined: "Offer Declined",
  hired: "Hired",
  rejected: "Rejected",
};

export const mockPipelineCandidates: PipelineCandidateRecord[] = [
  {
    id: "cand-001",
    name: "Mark Johnson",
    vacancyId: "vac-001",
    role: "Senior Backend Engineer",
    matchScore: 92,
    stage: "hr_interview_scheduled",
    aiSummary:
      "Strong backend profile with proven FastAPI and PostgreSQL experience. Good alignment with platform and API ownership.",
    cvReference: "uploads/mark-johnson-cv.pdf",
    parsedData: {
      name: "Mark Johnson",
      email: "mark.johnson@example.com",
      phone: "+31 6 12345678",
      skills: ["Python", "FastAPI", "PostgreSQL", "Docker"],
      experience: "7 years in backend platform engineering and API development.",
      education: "MSc Computer Science",
    },
  },
  {
    id: "cand-002",
    name: "Sarah Lee",
    vacancyId: "vac-001",
    role: "Senior Backend Engineer",
    matchScore: 86,
    stage: "hr_in_progress",
    aiSummary:
      "Balanced engineering profile with strong communication and modern service architecture exposure.",
    cvReference: "uploads/sarah-lee-cv.pdf",
    parsedData: {
      name: "Sarah Lee",
      email: "sarah.lee@example.com",
      phone: "+31 6 56781234",
      skills: ["Python", "REST APIs", "AWS", "Team leadership"],
      experience: "6 years across backend services and team coordination.",
      education: "BSc Software Engineering",
    },
  },
  {
    id: "cand-003",
    name: "Emily Watson",
    vacancyId: "vac-002",
    role: "Data Scientist",
    matchScore: 88,
    stage: "hr_passed",
    aiSummary:
      "Strong experimentation background with solid model evaluation and analytics communication skills.",
    cvReference: "uploads/emily-watson-cv.pdf",
    parsedData: {
      name: "Emily Watson",
      email: "emily.watson@example.com",
      phone: "+31 6 90123456",
      skills: ["Python", "SQL", "Machine Learning", "A/B Testing"],
      experience: "5 years in predictive analytics and experimentation programs.",
      education: "MSc Data Science",
    },
  },
  {
    id: "cand-004",
    name: "James Miller",
    vacancyId: "vac-002",
    role: "Data Scientist",
    matchScore: 80,
    stage: "technical_interview_scheduled",
    aiSummary:
      "Good stakeholder fit with practical analytics depth and clear business-facing delivery history.",
    cvReference: "uploads/james-miller-cv.pdf",
    parsedData: {
      name: "James Miller",
      email: "james.miller@example.com",
      phone: "+31 6 34567890",
      skills: ["SQL", "Forecasting", "Stakeholder management", "Tableau"],
      experience: "4 years building reporting and applied analytics solutions.",
      education: "BSc Applied Mathematics",
    },
  },
  {
    id: "cand-005",
    name: "Lisa Wong",
    vacancyId: "vac-003",
    role: "UX Researcher",
    matchScore: 78,
    stage: "technical_in_progress",
    aiSummary:
      "Well-rounded qualitative researcher with strong synthesis and recruiter workflow insight.",
    cvReference: "uploads/lisa-wong-cv.pdf",
    parsedData: {
      name: "Lisa Wong",
      email: "lisa.wong@example.com",
      phone: "+31 6 78905612",
      skills: ["User interviews", "Research ops", "Synthesis", "Journey mapping"],
      experience: "5 years in product research and service design.",
      education: "MA Human Computer Interaction",
    },
  },
  {
    id: "cand-006",
    name: "Jacob Smith",
    vacancyId: "vac-001",
    role: "Senior Backend Engineer",
    matchScore: 95,
    stage: "technical_passed",
    aiSummary:
      "Excellent technical and organizational fit with immediate readiness for a senior platform role.",
    cvReference: "uploads/jacob-smith-cv.pdf",
    parsedData: {
      name: "Jacob Smith",
      email: "jacob.smith@example.com",
      phone: "+31 6 65432109",
      skills: ["Python", "FastAPI", "PostgreSQL", "Architecture"],
      experience: "8 years building backend systems and leading delivery.",
      education: "BEng Software Engineering",
    },
  },
  {
    id: "cand-007",
    name: "Nina Patel",
    vacancyId: "vac-003",
    role: "UX Researcher",
    matchScore: 61,
    stage: "rejected",
    aiSummary:
      "Interesting profile, but current vacancy needs deeper recruitment-operations research experience.",
    cvReference: "uploads/nina-patel-cv.pdf",
    parsedData: {
      name: "Nina Patel",
      email: "nina.patel@example.com",
      phone: "+31 6 21098765",
      skills: ["Research", "Workshop facilitation", "Figma", "Surveys"],
      experience: "3 years in mixed-method product research.",
      education: "BA Psychology",
    },
  },
  {
    id: "cand-008",
    name: "Tom de Vries",
    vacancyId: "vac-001",
    role: "Senior Backend Engineer",
    matchScore: 90,
    stage: "management_interview_scheduled",
    aiSummary:
      "High-potential backend candidate with strong API design depth and solid cloud deployment exposure.",
    cvReference: "uploads/tom-de-vries-cv.pdf",
    parsedData: {
      name: "Tom de Vries",
      email: "tom.devries@example.com",
      phone: "+31 6 11223344",
      skills: ["Python", "FastAPI", "Azure", "Architecture"],
      experience: "6 years in backend platform work and distributed systems.",
      education: "BSc Information Technology",
    },
  },
  {
    id: "cand-009",
    name: "Noor Hassan",
    vacancyId: "vac-002",
    role: "Data Scientist",
    matchScore: 84,
    stage: "management_in_progress",
    aiSummary:
      "Strong analytical profile with solid experimentation habits and clear communication style.",
    cvReference: "uploads/noor-hassan-cv.pdf",
    parsedData: {
      name: "Noor Hassan",
      email: "noor.hassan@example.com",
      phone: "+31 6 44556677",
      skills: ["SQL", "Python", "Experimentation", "Reporting"],
      experience: "5 years in applied analytics and business-facing insights work.",
      education: "MSc Business Analytics",
    },
  },
  {
    id: "cand-010",
    name: "David Chen",
    vacancyId: "vac-001",
    role: "Senior Backend Engineer",
    matchScore: 89,
    stage: "selected",
    aiSummary:
      "Consistent technical performer with strong service design instincts and positive reviewer feedback.",
    cvReference: "uploads/david-chen-cv.pdf",
    parsedData: {
      name: "David Chen",
      email: "david.chen@example.com",
      phone: "+31 6 99887766",
      skills: ["Python", "System Design", "PostgreSQL", "Docker"],
      experience: "7 years across platform engineering and service ownership.",
      education: "MSc Computer Engineering",
    },
  },
  {
    id: "cand-011",
    name: "Aisha Rahman",
    vacancyId: "vac-003",
    role: "UX Researcher",
    matchScore: 83,
    stage: "offer_sent",
    aiSummary:
      "Management-ready finalist with strong collaboration skills and clear business-context communication.",
    cvReference: "uploads/aisha-rahman-cv.pdf",
    parsedData: {
      name: "Aisha Rahman",
      email: "aisha.rahman@example.com",
      phone: "+31 6 44332211",
      skills: ["Research", "Synthesis", "Workshops", "Journey Mapping"],
      experience: "6 years leading qualitative and mixed-method research programs.",
      education: "MA Human Factors",
    },
  },
  {
    id: "cand-012",
    name: "Peter Bos",
    vacancyId: "vac-002",
    role: "Data Scientist",
    matchScore: 82,
    stage: "offer_accepted",
    aiSummary:
      "Strong final-stage candidate who accepted the offer and is ready for onboarding handoff.",
    cvReference: "uploads/peter-bos-cv.pdf",
    parsedData: {
      name: "Peter Bos",
      email: "peter.bos@example.com",
      phone: "+31 6 55443322",
      skills: ["Python", "Forecasting", "SQL", "Stakeholder Alignment"],
      experience: "5 years in data science delivery and product analytics.",
      education: "MSc Econometrics",
    },
  },
];

export function getNextPipelineStage(stage: PipelineStage): PipelineStage | null {
  const currentIndex = pipelineStageOrder.indexOf(stage);

  if (
    currentIndex === -1 ||
    stage === "hired" ||
    stage === "rejected" ||
    stage === "offer_declined"
  ) {
    return null;
  }

  return pipelineStageOrder[currentIndex + 1] ?? null;
}

export const mockOnboardingEmployees: EmployeeRecord[] = [
  {
    id: "onb-001",
    fullName: "Mila Verhoeven",
    email: "mila.verhoeven@example.com",
    role: "Backend Engineer",
    department: "IT",
    managerId: "emp-004",
    managerName: "Nina Smit",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2026-04-15",
    onboardingStatus: "completed",
  },
  {
    id: "onb-002",
    fullName: "Owen van Dijk",
    email: "owen.vandijk@example.com",
    role: "IT Support Specialist",
    department: "IT",
    managerId: "emp-004",
    managerName: "Nina Smit",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2026-05-01",
    onboardingStatus: "in_progress",
  },
  {
    id: "onb-003",
    fullName: "Sophie de Boer",
    email: "sophie.deboer@example.com",
    role: "HR Coordinator",
    department: "People",
    managerId: "emp-005",
    managerName: "Daan Jansen",
    documentsStatus: "pending",
    signedOffer: true,
    startDate: "2026-05-12",
    onboardingStatus: "in_progress",
  },
  {
    id: "onb-004",
    fullName: "Luca Meijer",
    email: "luca.meijer@example.com",
    role: "Sales Associate",
    department: "Sales",
    managerId: "emp-006",
    managerName: "Emma de Wit",
    documentsStatus: "pending",
    signedOffer: false,
    startDate: null,
    onboardingStatus: "not_started",
  },
];

export const mockCompanyEmployees: EmployeeRecord[] = [
  {
    id: "emp-001",
    fullName: "Alexander Visser",
    email: "alexander.visser@example.com",
    role: "CEO",
    department: "Executive",
    managerId: null,
    managerName: null,
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2023-01-02",
    onboardingStatus: "completed",
  },
  {
    id: "emp-002",
    fullName: "Laura Bakker",
    email: "laura.bakker@example.com",
    role: "CFO",
    department: "Finance",
    managerId: "emp-001",
    managerName: "Alexander Visser",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2023-03-15",
    onboardingStatus: "completed",
  },
  {
    id: "emp-003",
    fullName: "Daan Jansen",
    email: "daan.jansen@example.com",
    role: "HR Manager",
    department: "People",
    managerId: "emp-001",
    managerName: "Alexander Visser",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2023-05-01",
    onboardingStatus: "completed",
  },
  {
    id: "emp-004",
    fullName: "Nina Smit",
    email: "nina.smit@example.com",
    role: "IT Manager",
    department: "IT",
    managerId: "emp-001",
    managerName: "Alexander Visser",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2023-04-10",
    onboardingStatus: "completed",
  },
  {
    id: "emp-005",
    fullName: "Emma de Wit",
    email: "emma.dewit@example.com",
    role: "Sales Manager",
    department: "Sales",
    managerId: "emp-001",
    managerName: "Alexander Visser",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2023-06-12",
    onboardingStatus: "completed",
  },
  {
    id: "emp-006",
    fullName: "Tom Peters",
    email: "tom.peters@example.com",
    role: "Financial Controller",
    department: "Finance",
    managerId: "emp-002",
    managerName: "Laura Bakker",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2024-01-08",
    onboardingStatus: "completed",
  },
  {
    id: "emp-007",
    fullName: "Sophie de Boer",
    email: "sophie.deboer@example.com",
    role: "Recruiter",
    department: "People",
    managerId: "emp-003",
    managerName: "Daan Jansen",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2024-02-19",
    onboardingStatus: "completed",
  },
  {
    id: "emp-008",
    fullName: "Mila Verhoeven",
    email: "mila.verhoeven@example.com",
    role: "Backend Engineer",
    department: "IT",
    managerId: "emp-004",
    managerName: "Nina Smit",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2024-03-11",
    onboardingStatus: "completed",
  },
  {
    id: "emp-009",
    fullName: "Owen van Dijk",
    email: "owen.vandijk@example.com",
    role: "IT Support Specialist",
    department: "IT",
    managerId: "emp-004",
    managerName: "Nina Smit",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2024-04-22",
    onboardingStatus: "completed",
  },
  {
    id: "emp-010",
    fullName: "Luca Meijer",
    email: "luca.meijer@example.com",
    role: "Sales Executive",
    department: "Sales",
    managerId: "emp-005",
    managerName: "Emma de Wit",
    documentsStatus: "completed",
    signedOffer: true,
    startDate: "2024-05-13",
    onboardingStatus: "completed",
  },
];

export function buildEmployeeHierarchy(records: EmployeeRecord[]): EmployeeHierarchyNode[] {
  const nodeMap = new Map<string, EmployeeHierarchyNode>();

  for (const employee of records) {
    nodeMap.set(employee.id, {
      id: employee.id,
      fullName: employee.fullName,
      role: employee.role,
      department: employee.department,
      managerId: employee.managerId,
      children: [],
    });
  }

  const roots: EmployeeHierarchyNode[] = [];

  for (const employee of records) {
    const node = nodeMap.get(employee.id);

    if (!node) {
      continue;
    }

    if (employee.managerId) {
      const managerNode = nodeMap.get(employee.managerId);

      if (managerNode) {
        managerNode.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  return roots;
}
