export type HiringRequestStatus = "pending" | "approved" | "rejected";
export type VacancyStatus = "open" | "on_hold" | "closed";
export type PipelineStage =
  | "applied"
  | "ranked"
  | "shortlisted"
  | "hr_review"
  | "hr_invite_sent"
  | "hr_interview_scheduled"
  | "hr_in_progress"
  | "hr_approved"
  | "hr_passed"
  | "technical_review"
  | "technical_interview_scheduled"
  | "technical_in_progress"
  | "technical_approved"
  | "technical_passed"
  | "management_review"
  | "management_interview_scheduled"
  | "management_in_progress"
  | "selected"
  | "offer_sent"
  | "offer_accepted"
  | "offer_declined"
  | "hired"
  | "rejected";

export type HiringRequestRecord = {
  id: string;
  jobTitle: string;
  department: string;
  budget: string;
  requirements: string;
  aiJobDescription: string;
  status: HiringRequestStatus;
  requestedBy: string;
  createdAt: string;
};

export type VacancyRecord = {
  id: string;
  title: string;
  department: string;
  status: VacancyStatus;
  createdAt: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  description: string;
  requirements: string[];
  summary: string;
};

export type HiddenPotentialRecord = {
  candidate_id: number;
  candidate_name: string;
  original_role: string;
  potential_score: number;
  reason: string;
};

export type VacancyDiscoverySummaryApiRecord = {
  vacancy_id: number;
  new_discoveries: HiddenPotentialRecord[];
  top_candidates: HiddenPotentialRecord[];
};

export type ParsedCandidateData = {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string;
  education: string;
  location?: string;
  workAuthorization?: string;
  noticePeriod?: string;
  fitExplanation?: string;
};

export type InterviewStageTypeApi = "hr" | "technical" | "management";

export type PipelineCandidateRecord = {
  id: string;
  name: string;
  vacancyId: string;
  role: string;
  matchScore: number;
  stage: PipelineStage;
  applicationStage?: ApplicationStageApi;
  interviewAt?: string | null;
  interviewStageType?: InterviewStageTypeApi | null;
  rejectionEmailSent?: boolean;
  aiSummary: string;
  cvReference: string;
  parsedData: ParsedCandidateData;
};

export type EmployeeOnboardingStatus = "not_started" | "in_progress" | "completed";

export type EmployeeRecord = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  managerId: string | null;
  managerName: string | null;
  documentsStatus: string;
  signedOffer: boolean;
  startDate: string | null;
  onboardingStatus: EmployeeOnboardingStatus;
};

export type EmployeeHierarchyNode = {
  id: string;
  fullName: string;
  role: string;
  department: string;
  managerId: string | null;
  children: EmployeeHierarchyNode[];
};

export type DepartmentOption = {
  id: number;
  name: string;
  description?: string | null;
};

export type UserApiRecord = {
  id: number;
  full_name: string;
  email: string;
  role: "HR" | "Technical" | "Manager" | "Admin";
  department_id?: number | null;
};

export type VacancyApiRecord = {
  id: number;
  title: string;
  description: string;
  required_skills: string[];
  experience_level?: string | null;
  status: VacancyStatus;
  department_id: number;
  hiring_request_id?: number | null;
  ai_summary?: string | null;
  match_score?: number | null;
  parsed_data: Record<string, unknown>;
  created_at: string;
};

export type CandidateApiRecord = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  skills: string[];
  experience?: string | null;
  education?: string | null;
  ai_summary?: string | null;
  match_score?: number | null;
  parsed_data: Record<string, unknown>;
};

export type AppliedMatchInsightsApiRecord = {
  vacancy_id: string;
  role_name: string;
  score: number;
  analysis: string;
};

export type PotentialMatchInsightsApiRecord = {
  vacancy_id: string;
  role_name: string;
  score: number;
  discovery_reason: string;
};

export type TalentInsightsApiRecord = {
  overall_score: number;
  top_skills_identified: string[];
  seniority_level: string;
};

export type CandidateMatchingInsightsApiRecord = {
  applied_match?: AppliedMatchInsightsApiRecord | null;
  potential_match?: PotentialMatchInsightsApiRecord | null;
  talent_insights: TalentInsightsApiRecord;
};

export type ApplicationStageApi =
  | "parsed"
  | "ranked"
  | "primary_shortlist"
  | "reserve_shortlist"
  | "excluded"
  | "hr_invite_selected"
  | "hr_invite_sent"
  | "hr_interview_scheduled"
  | "hr_in_progress"
  | "hr_passed"
  | "hr_rejected"
  | "technical_interview_scheduled"
  | "technical_in_progress"
  | "technical_passed"
  | "technical_rejected"
  | "management_interview_scheduled"
  | "management_in_progress"
  | "selected"
  | "management_rejected"
  | "offer_sent"
  | "offer_accepted"
  | "offer_declined"
  | "hired";

export type ShortlistBucketApi = "none" | "primary" | "reserve";

export type ApplicationApiRecord = {
  id: number;
  candidate_id: number;
  vacancy_id: number;
  notes?: string | null;
  ai_summary?: string | null;
  match_score?: number | null;
  parsed_data: Record<string, unknown>;
  stage: ApplicationStageApi;
  current_owner_role?: "HR" | "Technical" | "Manager" | "Admin" | null;
  ranking_score?: number | null;
  ranking_position?: number | null;
  shortlist_bucket: ShortlistBucketApi;
  invite_selected: boolean;
  rejection_reason?: string | null;
  selected_for_offer: boolean;
  invite_sent_at?: string | null;
  invite_sent_by_id?: number | null;
  hr_interview_at?: string | null;
  technical_interview_at?: string | null;
  management_interview_at?: string | null;
  offer_sent_at?: string | null;
  offer_accepted_at?: string | null;
  offer_declined_at?: string | null;
  created_at: string;
};

export type ApplicationSendInviteResponse = {
  application_id: number;
  email_type:
    | "hr_invite"
    | "hr_passed"
    | "hr_rejection"
    | "technical_passed"
    | "technical_rejection"
    | "management_rejection"
    | "offer_sent";
  status: string;
  message: string;
  callback_url: string;
};

export type StoredCandidateRecord = {
  id: string;
  name: string;
  email: string;
  aiSummary: string;
  skills: string[];
  experience: string;
  education: string;
  linkedVacancyId: string | null;
  linkedVacancyTitle: string;
  matchScore: number | null;
  fitExplanation: string;
  matchedSkills: string[];
  uploadedAt: string;
  parsedData: Record<string, unknown>;
};

export type CandidateRoleSuggestionApiRecord = {
  id: number;
  candidate_id: number;
  role_title: string;
  department?: string | null;
  confidence_score: number;
  reason?: string | null;
  created_at: string;
};

export type CandidateMatchApiRecord = {
  id: number;
  candidate_id: number;
  candidate_name?: string | null;
  vacancy_id: number;
  match_score: number;
  ai_summary?: string | null;
  fit_explanation?: string | null;
  matched_skills: string[];
  created_at: string;
};

export type CandidateParseResponse = {
  candidate: CandidateApiRecord;
  vacancy?: VacancyApiRecord | null;
  match?: CandidateMatchApiRecord | null;
  matching?: CandidateMatchingInsightsApiRecord | null;
  role_suggestions: CandidateRoleSuggestionApiRecord[];
  extracted_text_preview: string;
  parsed_candidate: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    skills: string[];
    experience?: string | null;
    education?: string | null;
    ai_summary?: string | null;
    match_score?: number | null;
    parsed_data: Record<string, unknown>;
  };
};

export type CandidateBatchParseFailure = {
  filename: string;
  error: string;
};

export type CandidateBatchParseResponse = {
  total_files: number;
  success_count: number;
  failure_count: number;
  results: CandidateParseResponse[];
  failures: CandidateBatchParseFailure[];
};

export type CandidateQueueParseJobResponse = {
  parse_job_id: number;
  vacancy_id: number;
  file_name: string;
  original_file_name?: string | null;
  file_path: string;
  status: string;
  candidate_id?: number | null;
  application_id?: number | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  parsed_at?: string | null;
};

export type CandidateQueueParseBatchResponse = {
  total_files: number;
  queued_count: number;
  jobs: CandidateQueueParseJobResponse[];
};

export type JobDescriptionGenerateResponse = {
  generated_job_description: string;
  generated_required_skills: string[];
  summary?: string | null;
  suggested_max_budget?: string | null;
};

export type DashboardSummaryKpiApiRecord = {
  label: string;
  value: string;
  delta: string;
};

export type HRDashboardSummaryApiRecord = {
  title: string;
  description: string;
  kpis: DashboardSummaryKpiApiRecord[];
};

export type DashboardActivityApiRecord = {
  id: string;
  title: string;
  status: string;
  timestamp: string;
  candidate_name: string;
  candidate_role: string;
  candidate_initials: string;
};

export type HRDashboardActivityResponseApiRecord = {
  items: DashboardActivityApiRecord[];
};

export type LinkedInPreviewApiRecord = {
  success: boolean;
  dry_run: boolean;
  message: string;
  post_text: string;
  apply_url: string;
};
