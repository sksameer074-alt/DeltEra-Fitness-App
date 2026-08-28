import re
import uuid
from datetime import date as dt_date
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

Role = Literal["trainer", "client"]
Sex = Literal["male", "female", "other"]
ActivityLevel = Literal["lightly active", "moderately active", "very active"]
SessionStatus = Literal["upcoming", "done", "missed"]

MEAL_PLAN_WORD_LIMIT = 5000
MAX_DIET_PHOTOS = 10

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_PHONE_RE = re.compile(r"^\d{10}$")
PASSWORD_MIN_LEN = 6


def _check_time(v: str) -> str:
    if not _TIME_RE.match(v):
        raise ValueError('time must be "HH:MM" 24-hour, e.g. "18:30"')
    return v


def _check_phone(v: str) -> str:
    if not _PHONE_RE.match(v):
        raise ValueError("phone_number must be exactly 10 digits (numbers only)")
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


class UserBase(ProfileFields):
    name: str


class SignupRequest(UserBase):
    phone_number: str
    password: str = Field(min_length=PASSWORD_MIN_LEN)
    role: Role = "client"

    _v_phone = field_validator("phone_number")(_check_phone)


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


class UserOut(UserBase, MetricFields):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone_number: str
    role: Role
    package: Optional[PackageBrief] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---- Schedules ----


class ScheduleEntry(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0=Monday .. 6=Sunday")
    time: str = Field(description='"HH:MM" 24h, IST')

    _v_time = field_validator("time")(_check_time)


class ScheduleReplace(BaseModel):
    entries: List[ScheduleEntry]


class ScheduleOut(ScheduleEntry):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID


# ---- Sessions (unchanged) ----


class SessionCreate(BaseModel):
    date: dt_date
    status: SessionStatus = "upcoming"
    workout_details: Optional[str] = None


class SessionUpdate(BaseModel):
    date: Optional[dt_date] = None
    status: Optional[SessionStatus] = None
    workout_details: Optional[str] = None
    client_rating: Optional[int] = Field(default=None, ge=1, le=5)
    client_comment: Optional[str] = None
    trainer_rating: Optional[int] = Field(default=None, ge=1, le=5)


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    date: dt_date
    status: SessionStatus
    workout_details: Optional[str] = None
    client_rating: Optional[int] = None
    client_comment: Optional[str] = None
    trainer_rating: Optional[int] = None


class WeekSummary(BaseModel):
    week_start: dt_date
    week_end: dt_date
    done: int
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


class MeUpdate(BaseModel):
    profile_photo_url: Optional[str] = Field(default=None, max_length=8_000_000)
    feeling_note: Optional[str] = None


# ---- Announcements ----


class AnnouncementIn(BaseModel):
    message: str = Field(min_length=1)


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    message: str
    created_at: datetime


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
