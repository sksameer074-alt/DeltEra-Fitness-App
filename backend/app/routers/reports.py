from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import load_accessible_client, require_self_client
from ..models import Report, User
from ..schemas import ReportIn, ReportOut

router = APIRouter(prefix="/clients/{client_id}/reports", tags=["reports"])


@router.get("", response_model=list[ReportOut])
def list_reports(
    target: User = Depends(load_accessible_client),  # trainer any / client self
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(Report)
            .where(Report.client_id == target.id)
            .order_by(Report.uploaded_at.desc())
        )
    )


@router.post("", response_model=ReportOut, status_code=201)
def upload_report(
    payload: ReportIn,
    client: User = Depends(require_self_client),  # only the client uploads their own
    db: Session = Depends(get_db),
):
    row = Report(client_id=client.id, file_url=payload.file_url, note=payload.note)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
