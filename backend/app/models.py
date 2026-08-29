import uuid
from datetime import date as dt_date
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role in ('trainer', 'client')", name="users_role_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone_number: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    password: Mapped[str] = mapped_column(String, nullable=False)  # bcrypt hash
    role: Mapped[str] = mapped_column(String, nullable=False, index=True)

    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sex: Mapped[str | None] = mapped_column(String, nullable=True)
    activity_level: Mapped[str | None] = mapped_column(String, nullable=True)
    profile_photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    feeling_note: Mapped[str | None] = mapped_column(String, nullable=True)

    has_injury: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    injury_comment: Mapped[str | None] = mapped_column(String, nullable=True)
    has_health_condition: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    health_condition_comment: Mapped[str | None] = mapped_column(String, nullable=True)

    # Trainer-entered body metrics. Not calculated. NULL until the trainer sets them.
    bmi: Mapped[float | None] = mapped_column(Float, nullable=True)
    bmr: Mapped[float | None] = mapped_column(Float, nullable=True)
    tdee: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Trainer public-landing content (only meaningful for role='trainer').
    bio: Mapped[str | None] = mapped_column(String, nullable=True)
    credentials: Mapped[str | None] = mapped_column(String, nullable=True)

    # Landing-page headline numbers. Trainer types these in by hand; they are
    # NOT counted from the transformations / users / sessions tables.
    total_clients_stat: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_transformations_stat: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_sessions_stat: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    schedules: Mapped[list["Schedule"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )


class Schedule(Base):
    """One weekly training slot for a client. `time` is India Standard Time."""

    __tablename__ = "schedules"
    __table_args__ = (
        CheckConstraint(
            "day_of_week >= 0 and day_of_week <= 6", name="schedules_day_of_week_check"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon .. 6=Sun
    time: Mapped[str] = mapped_column(String, nullable=False)  # "HH:MM" 24h, IST

    client: Mapped["User"] = relationship(back_populates="schedules")


class TrainingSession(Base):
    """A dated training session with an outcome status. (Unchanged — manual creation.)"""

    __tablename__ = "sessions"
    __table_args__ = (
        CheckConstraint(
            "status in ('upcoming', 'done', 'missed')", name="sessions_status_check"
        ),
        CheckConstraint(
            "client_rating is null or (client_rating between 1 and 5)",
            name="sessions_client_rating_check",
        ),
        CheckConstraint(
            "trainer_rating is null or (trainer_rating between 1 and 5)",
            name="sessions_trainer_rating_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[dt_date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="upcoming")
    workout_details: Mapped[str | None] = mapped_column(String, nullable=True)
    client_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    client_comment: Mapped[str | None] = mapped_column(String, nullable=True)
    trainer_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)


class MealPlan(Base):
    """One free-text meal plan per client, written by the trainer."""

    __tablename__ = "meal_plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    plan_text: Mapped[str] = mapped_column(String, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Supplement(Base):
    __tablename__ = "supplements"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    dosage: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)


class Note(Base):
    """Trainer-only notes about a client. Never exposed to the client."""

    __tablename__ = "notes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    note_text: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ProgressLog(Base):
    """Client's daily weight check-in. One row per client per date."""

    __tablename__ = "progress_logs"
    __table_args__ = (
        UniqueConstraint("client_id", "date", name="progress_logs_client_date_uq"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    date: Mapped[dt_date] = mapped_column(Date, nullable=False)


class WeeklyMeasurement(Base):
    """Client's weekly body measurements."""

    __tablename__ = "weekly_measurements"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[dt_date] = mapped_column(Date, nullable=False)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    chest_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    waist_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    thighs_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    arm_cm: Mapped[float | None] = mapped_column(Float, nullable=True)


class DietPhoto(Base):
    """One diet-photo entry per client per date.

    `photos` is a JSON array (max 10) of {photo_url, note?}.
    """

    __tablename__ = "diet_photos"
    __table_args__ = (
        UniqueConstraint("client_id", "date", name="diet_photos_client_date_uq"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[dt_date] = mapped_column(Date, nullable=False)
    photos: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # when the client last changed `photos`; used by the 24h auto-purge job
    photos_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    trainer_comment: Mapped[str | None] = mapped_column(String, nullable=True)
    trainer_comment_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Trainer's 1-5 rating of the client's diet discipline for the day.
    trainer_diet_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Report(Base):
    """A file (PDF or image) uploaded by the client. Stored permanently."""

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_url: Mapped[str] = mapped_column(String, nullable=False)  # data URL or link
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Package(Base):
    """A block of purchased sessions. The newest row is the client's current package.

    `sessions_used` is bumped automatically when a session is marked done.
    `sessions_remaining` is a generated column.
    """

    __tablename__ = "packages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trainer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False)
    sessions_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sessions_remaining: Mapped[int] = mapped_column(
        Integer, Computed("total_sessions - sessions_used")
    )
    start_date: Mapped[dt_date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Payment(Base):
    """Trainer-recorded payment. Never visible to the client."""

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    method: Mapped[str] = mapped_column(String, nullable=False)  # Cash / PhonePe / UPI / ...
    date: Mapped[dt_date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)


class Announcement(Base):
    """One broadcast message from the trainer. Newest is shown to all clients."""

    __tablename__ = "announcements"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    message: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Transformation(Base):
    """Before/after showcase entry for the public landing page (trainer-managed)."""

    __tablename__ = "transformations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_name: Mapped[str] = mapped_column(String, nullable=False)
    before_photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    after_photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    caption: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
