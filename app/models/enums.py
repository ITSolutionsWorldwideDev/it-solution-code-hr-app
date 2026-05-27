from enum import Enum


class UserRole(str, Enum):
    HR = "HR"
    TECHNICAL = "Technical"
    MANAGER = "Manager"
    ADMIN = "Admin"


class HiringRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class VacancyStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    ON_HOLD = "on_hold"


class OnboardingStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ApplicationStage(str, Enum):
    PARSED = "parsed"
    RANKED = "ranked"
    PRIMARY_SHORTLIST = "primary_shortlist"
    RESERVE_SHORTLIST = "reserve_shortlist"
    EXCLUDED = "excluded"
    HR_INVITE_SELECTED = "hr_invite_selected"
    HR_INVITE_SENT = "hr_invite_sent"
    HR_INTERVIEW_SCHEDULED = "hr_interview_scheduled"
    HR_IN_PROGRESS = "hr_in_progress"
    HR_PASSED = "hr_passed"
    HR_REJECTED = "hr_rejected"
    TECHNICAL_INTERVIEW_SCHEDULED = "technical_interview_scheduled"
    TECHNICAL_IN_PROGRESS = "technical_in_progress"
    TECHNICAL_PASSED = "technical_passed"
    TECHNICAL_REJECTED = "technical_rejected"
    MANAGEMENT_INTERVIEW_SCHEDULED = "management_interview_scheduled"
    MANAGEMENT_IN_PROGRESS = "management_in_progress"
    SELECTED = "selected"
    MANAGEMENT_REJECTED = "management_rejected"
    OFFER_SENT = "offer_sent"
    OFFER_ACCEPTED = "offer_accepted"
    OFFER_DECLINED = "offer_declined"
    HIRED = "hired"


class ShortlistBucket(str, Enum):
    NONE = "none"
    PRIMARY = "primary"
    RESERVE = "reserve"


class InterviewStageType(str, Enum):
    HR = "hr"
    TECHNICAL = "technical"
    MANAGEMENT = "management"


class InterviewStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class InterviewDecision(str, Enum):
    PENDING = "pending"
    PASSED = "passed"
    REJECTED = "rejected"


class EmailType(str, Enum):
    HR_INVITE = "hr_invite"
    HR_REJECTION = "hr_rejection"
    HR_PASSED = "hr_passed"
    TECHNICAL_REJECTION = "technical_rejection"
    TECHNICAL_PASSED = "technical_passed"
    MANAGEMENT_REJECTION = "management_rejection"
    OFFER_SENT = "offer_sent"


class EmailStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
