import re
import uuid
from datetime import date as dt_date
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

Role = Literal["trainer", "client"]
Sex = Literal["male", "female", "other"]
ActivityLevel = Literal["lightly active", "moderately active", "very active"]
SessionStatus = Literal["upcoming", "needs_review", "completed", "missed"]

MEAL_PLAN_WORD_LIMIT = 5000
MAX_DIET_PHOTOS = 10

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_PHONE_RE = re.compile(r"^\d{10}$")
PASSWORD_MIN_LEN = 6


def _check_time(v: str) -> str:
    if not _TIME_RE.match(v):
        raise ValueError('time must be "HH:MM" 24-hour, e.g. "18:30"')
    return v


def _check_time_optional(v: Optional[str]) -> Optional[str]:
    return _check_time(v) if v else v


def _check_phone(v: str) -> str:
    if not _PHONE_RE.match(v):
        raise ValueError("phone_number must be exactly 10 digits (numbers only)")
    return v


def _check_timezone(v: Optional[str]) -> Optional[str]:
    if v is None or v == "":
        return None
    from .timeutil import is_valid_timezone

    if not is_valid_timezone(v):
        raise ValueError(f"'{v}' is not a valid IANA timezone")
    return v


def word_count(text: str) -> int:
    return len(text.split())


# ---- Users / profile ----


class ProfileFields(BaseModel):
    weight: Optional[float] = None
    height: Optional[float] = None
    age: Optional[int] = None
    sex: Optional[Sex] = None
    activity_level: Optional[ActivityLevel] = None
    profile_photo_url: Optional[str] = None
    feeling_note: Optional[str] = None
    has_injury: bool = False
    injury_comment: Optional[str] = None
    has_health_condition: bool = False
    health_condition_comment: Optional[str] = None


class MetricFields(BaseModel):
    """Trainer-entered only. Not calculated."""

    bmi: Optional[float] = None
    bmr: Optional[float] = None
    tdee: Optional[float] = None


class LandingStatsFields(BaseModel):
    """The landing page's headline numbers. Typed in by the trainer; never
    computed from the transformations / users / sessions tables."""

    total_clients_stat: Optional[int] = Field(default=None, ge=0)
    total_transformations_stat: Optional[int] = Field(default=None, ge=0)
    total_sessions_stat: Optional[int] = Field(default=None, ge=0)


# ---- Trainer-edited landing-page content (one JSON blob on the user row) ----


class WhyChooseItem(BaseModel):
    title: str = Field(default="", max_length=80)
    description: str = Field(default="", max_length=240)


class Testimonial(BaseModel):
    name: str = Field(default="", max_length=80)
    quote: str = Field(default="", max_length=800)
    rating: int = Field(default=5, ge=1, le=5)


class FaqItem(BaseModel):
    question: str = Field(default="", max_length=240)
    answer: str = Field(default="", max_length=1200)


class LandingContent(BaseModel):
    """Shape of `users.landing_content`. Used both for PATCH /users/me input and
    the GET /public/landing response — extra keys are ignored, missing keys
    fall back to empty."""

    model_config = ConfigDict(extra="ignore")

    hero_headline: str = Field(default="", max_length=140)
    hero_subheadline: str = Field(default="", max_length=280)
    why_choose_us: List[WhyChooseItem] = Field(default_factory=list, max_length=6)
    testimonials: List[Testimonial] = Field(default_factory=list, max_length=24)
    faq: List[FaqItem] = Field(default_factory=list, max_length=24)
    contact_phone: str = Field(default="", max_length=40)
    instagram: str = Field(default="", max_length=120)


class UserBase(ProfileFields):
    name: str


class SignupRequest(BaseModel):
    # Public signup ALWAYS creates a client. There is deliberately no `role`
    # field here, and the endpoint hardcodes role="client" regardless of the
    # request body. The single trainer account is created out of band
    # (backend/create_trainer.py).
    #
    # Every field is REQUIRED except the injury / health-condition info, which
    # stays optional (both here and on the form).
    name: str = Field(min_length=1)
    phone_number: str
    password: str = Field(min_length=PASSWORD_MIN_LEN)
    weight: float = Field(gt=0)
    height: float = Field(gt=0)
    age: int = Field(gt=0, lt=120)
    sex: Sex
    activity_level: ActivityLevel

    has_injury: bool = False
    injury_comment: Optional[str] = None
    has_health_condition: bool = False
    health_condition_comment: Optional[str] = None

    # client's detected browser timezone (IANA); optional
    timezone: Optional[str] = None

    _v_phone = field_validator("phone_number")(_check_phone)
    _v_tz = field_validator("timezone")(_check_timezone)


class LoginRequest(BaseModel):
    phone_number: str
    password: str


class ClientCreate(UserBase, MetricFields):
    phone_number: str
    password: str = Field(min_length=PASSWORD_MIN_LEN)

    _v_phone = field_validator("phone_number")(_check_phone)


class ResetPasswordIn(BaseModel):
    new_password: str = Field(min_length=PASSWORD_MIN_LEN)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=PASSWORD_MIN_LEN)


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    age: Optional[int] = None
    sex: Optional[Sex] = None
    activity_level: Optional[ActivityLevel] = None
    has_injury: Optional[bool] = None
    injury_comment: Optional[str] = None
    has_health_condition: Optional[bool] = None
    health_condition_comment: Optional[str] = None
    bmi: Optional[float] = None
    bmr: Optional[float] = None
    tdee: Optional[float] = None


class PackageBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_sessions: int
    sessions_used: int
    sessions_remaining: int
    trainer_name: Optional[str] = None


class UserOut(UserBase, MetricFields, LandingStatsFields):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone_number: str
    role: Role
    package: Optional[PackageBrief] = None
    timezone: Optional[str] = None
    # trainer landing-page content (also public via /public/landing)
    bio: Optional[str] = None
    credentials: Optional[str] = None
    landing_content: LandingContent = Field(default_factory=LandingContent)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---- Schedules ----


class ScheduleEntry(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0=Monday .. 6=Sunday, IST")
    time: str = Field(description='"HH:MM" 24h, IST (the trainer\'s authoring tz)')

    _v_time = field_validator("time")(_check_time)


class ScheduleReplace(BaseModel):
    entries: List[ScheduleEntry]


class ScheduleOut(ScheduleEntry):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID


# ---- Sessions ----


class SessionCreate(BaseModel):
    """A one-off session added by the trainer outside the weekly template.
    `date` is the IST calendar date; `time` (IST "HH:MM") is optional — when
    given, the session gets a concrete UTC `starts_at`."""

    date: dt_date
    time: Optional[str] = None
    status: SessionStatus = "upcoming"
    workout_details: Optional[str] = None
    notes: Optional[str] = None

    _v_time = field_validator("time")(_check_time_optional)


class SessionUpdate(BaseModel):
    date: Optional[dt_date] = None
    time: Optional[str] = None
    status: Optional[SessionStatus] = None
    workout_details: Optional[str] = None
    notes: Optional[str] = None
    client_rating: Optional[int] = Field(default=None, ge=1, le=5)
    client_comment: Optional[str] = None
    trainer_rating: Optional[int] = Field(default=None, ge=1, le=5)

    _v_time = field_validator("time")(_check_time_optional)


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    date: dt_date
    starts_at: Optional[datetime] = None
    status: SessionStatus
    auto_generated: bool = False
    workout_details: Optional[str] = None
    notes: Optional[str] = None
    client_rating: Optional[int] = None
    client_comment: Optional[str] = None
    trainer_rating: Optional[int] = None


class WeekSummary(BaseModel):
    week_start: dt_date
    week_end: dt_date
    completed: int
    needs_review: int
    missed: int
    upcoming: int
    remaining: int
    total: int
    sessions: List[SessionOut]
    next_session: Optional[SessionOut] = None


# ---- Meal plan (free text, trainer-written, 5000-word cap) ----


class MealPlanUpdate(BaseModel):
    plan_text: str

    @field_validator("plan_text")
    @classmethod
    def _limit(cls, v: str) -> str:
        if word_count(v) > MEAL_PLAN_WORD_LIMIT:
            raise ValueError(
                f"plan_text is {word_count(v)} words; the limit is {MEAL_PLAN_WORD_LIMIT}"
            )
        return v


class MealPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    client_id: uuid.UUID
    plan_text: str
    updated_at: Optional[datetime] = None
    word_count: int = 0
    word_limit: int = MEAL_PLAN_WORD_LIMIT


# ---- Supplements ----


class SupplementIn(BaseModel):
    name: str
    dosage: Optional[str] = None
    notes: Optional[str] = None


class SupplementUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    notes: Optional[str] = None


class SupplementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    dosage: Optional[str] = None
    notes: Optional[str] = None


# ---- Notes (trainer-only) ----


class NoteIn(BaseModel):
    note_text: str


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    note_text: str
    created_at: datetime


# ---- Progress: daily weight check-in ----


class ProgressLogIn(BaseModel):
    weight: float = Field(gt=0)
    date: Optional[dt_date] = None  # defaults to today server-side


class ProgressLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    weight: float
    date: dt_date


# ---- Progress: weekly measurements ----


class WeeklyMeasurementIn(BaseModel):
    date: Optional[dt_date] = None
    weight: Optional[float] = None
    chest_cm: Optional[float] = None
    waist_cm: Optional[float] = None
    thighs_cm: Optional[float] = None
    arm_cm: Optional[float] = None


class WeeklyMeasurementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    date: dt_date
    weight: Optional[float] = None
    chest_cm: Optional[float] = None
    waist_cm: Optional[float] = None
    thighs_cm: Optional[float] = None
    arm_cm: Optional[float] = None


# ---- Diet photos ----


class DietPhotoItem(BaseModel):
    photo_url: str = Field(min_length=1, max_length=8_000_000)
    note: Optional[str] = None


class DietPhotoUpsert(BaseModel):
    date: Optional[dt_date] = None
    photos: List[DietPhotoItem] = Field(default_factory=list, max_length=MAX_DIET_PHOTOS)


class DietPhotoReviewIn(BaseModel):
    """Trainer's review of a day's check-in: a comment and/or a 1-5 discipline rating."""

    trainer_comment: Optional[str] = None
    trainer_diet_rating: Optional[int] = Field(default=None, ge=1, le=5)


class DietPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    date: dt_date
    photos: List[DietPhotoItem]
    trainer_comment: Optional[str] = None
    trainer_comment_at: Optional[datetime] = None
    trainer_diet_rating: Optional[int] = None


# ---- Reports (client-uploaded files) ----


class ReportIn(BaseModel):
    file_url: str = Field(min_length=1, max_length=20_000_000)
    note: Optional[str] = None


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    file_url: str
    note: Optional[str] = None
    uploaded_at: datetime


# ---- Self-service profile edits (client or trainer, on their own record) ----


class MeUpdate(LandingStatsFields):
    profile_photo_url: Optional[str] = Field(default=None, max_length=8_000_000)
    feeling_note: Optional[str] = None
    bio: Optional[str] = None
    credentials: Optional[str] = None
    landing_content: Optional[LandingContent] = None
    timezone: Optional[str] = None

    _v_tz = field_validator("timezone")(_check_timezone)


# ---- Announcements ----


class AnnouncementIn(BaseModel):
    message: str = Field(min_length=1)


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    message: str
    created_at: datetime


# ---- Transformations + public landing ----


class TransformationIn(BaseModel):
    client_name: str = Field(min_length=1)
    before_photo_url: Optional[str] = Field(default=None, max_length=8_000_000)
    after_photo_url: Optional[str] = Field(default=None, max_length=8_000_000)
    caption: Optional[str] = None


class TransformationUpdate(BaseModel):
    client_name: Optional[str] = None
    before_photo_url: Optional[str] = Field(default=None, max_length=8_000_000)
    after_photo_url: Optional[str] = Field(default=None, max_length=8_000_000)
    caption: Optional[str] = None


class TransformationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_name: str
    before_photo_url: Optional[str] = None
    after_photo_url: Optional[str] = None
    caption: Optional[str] = None
    created_at: datetime


class PublicTrainer(BaseModel):
    name: str
    profile_photo_url: Optional[str] = None
    bio: Optional[str] = None
    credentials: Optional[str] = None


class LandingOut(BaseModel):
    trainer: Optional[PublicTrainer] = None
    transformations: List[TransformationOut]
    stats: dict  # {clients, transformations, sessions} — the trainer's manual numbers
    content: LandingContent = Field(default_factory=LandingContent)


class PurgeResult(BaseModel):
    cleared: int
    older_than_hours: float


# ---- Analytics (trainer dashboard) ----


class ClientAttendance(BaseModel):
    client_id: uuid.UUID
    name: str
    done: int
    missed: int
    attendance_rate: Optional[float] = None  # done / (done + missed)


class MonthlyRevenue(BaseModel):
    month: str  # "YYYY-MM"
    total: float


class AnalyticsOut(BaseModel):
    active_clients: int
    clients_last_session_or_zero: int
    attendance: List[ClientAttendance]
    monthly_revenue: List[MonthlyRevenue]


# ---- Packages ----


class PackageCreate(BaseModel):
    total_sessions: int = Field(gt=0)
    start_date: Optional[dt_date] = None


class PackageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    total_sessions: int
    sessions_used: int
    sessions_remaining: int
    start_date: dt_date
    created_at: datetime
    trainer_name: Optional[str] = None


# ---- Payments (trainer-only) ----


class PaymentIn(BaseModel):
    amount: float = Field(gt=0)
    method: str = Field(min_length=1)
    date: Optional[dt_date] = None
    notes: Optional[str] = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    amount: float
    method: str
    date: dt_date
    notes: Optional[str] = None
