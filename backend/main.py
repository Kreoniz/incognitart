from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path
from uuid import uuid4
import aiofiles
from datetime import datetime, timedelta
from starlette.concurrency import run_in_threadpool

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
    select,
    desc,
    delete,
)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.exc import IntegrityError

# --- DB setup (SQLite) ---
DATABASE_URL = "sqlite:///./app.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    author_name = Column(String, nullable=True)
    image_name = Column(String, nullable=True)
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False, unique=True, index=True)
    content_type = Column(String, nullable=True)
    size = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(
        Integer, ForeignKey("images.id", ondelete="CASCADE"), nullable=False
    )
    user_hash = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("image_id", "user_hash", name="uix_image_user"),)


Base.metadata.create_all(bind=engine)

# --- App setup ---
app = FastAPI(title="Simple Image Upload + Gallery API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

IMAGES_DIR = Path("data/images")
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# serve uploaded images at /images/<stored_filename>
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")


# --- Pydantic schemas ---
class ImageOut(BaseModel):
    id: int
    author_name: Optional[str]
    image_name: Optional[str]
    original_filename: str
    stored_filename: str
    content_type: Optional[str]
    size: Optional[int]
    created_at: datetime
    likes_count: int
    liked_by_user: bool
    image_url: str

    class Config:
        orm_mode = True


class LikeAction(BaseModel):
    user_hash: str
    action: str  # "like" or "unlike"


# --- Helpers (DB work runs inside threadpool) ---
def _create_image_record(
    author_name, image_name, original_filename, stored_filename, content_type, size
):
    db = SessionLocal()
    try:
        img = Image(
            author_name=author_name,
            image_name=image_name,
            original_filename=original_filename,
            stored_filename=stored_filename,
            content_type=content_type,
            size=size,
            created_at=datetime.utcnow(),
        )
        db.add(img)
        db.commit()
        db.refresh(img)
        return img
    finally:
        db.close()


def _get_total_likes_for_ids(db, ids: List[int]) -> dict:
    if not ids:
        return {}
    rows = db.execute(
        select(Like.image_id, func.count(Like.id))
        .where(Like.image_id.in_(ids))
        .group_by(Like.image_id)
    ).all()
    return {r[0]: r[1] for r in rows}


def _get_liked_ids_by_user(db, ids: List[int], user_hash: str) -> set:
    if not ids or not user_hash:
        return set()
    rows = db.execute(
        select(Like.image_id).where(Like.image_id.in_(ids), Like.user_hash == user_hash)
    ).all()
    return {r[0] for r in rows}


# --- Endpoints ---


@app.post("/image", response_model=ImageOut)
async def upload_image(
    request: Request,
    authorName: Optional[str] = Form(None),
    imageName: Optional[str] = Form(None),
    image: UploadFile = File(...),
):
    """
    Upload an image via form-data:
      - authorName (optional)
      - imageName (optional)
      - image (file)
    Returns saved image metadata (including image_url).
    """
    if not image:
        raise HTTPException(status_code=400, detail="No image file provided")

    contents = await image.read()
    size = len(contents)

    original = Path(image.filename or "upload")
    ext = original.suffix or ".png"
    stored_filename = f"{uuid4().hex}{ext}"
    stored_path = IMAGES_DIR / stored_filename

    async with aiofiles.open(stored_path, "wb") as f:
        await f.write(contents)

    img = await run_in_threadpool(
        _create_image_record,
        authorName,
        imageName,
        str(original.name),
        stored_filename,
        image.content_type,
        size,
    )

    # build image_url (absolute)
    base = str(request.base_url)  # includes trailing slash
    image_url = base.rstrip("/") + f"/images/{stored_filename}"

    # likes initially zero
    return ImageOut(
        id=img.id,
        author_name=img.author_name,
        image_name=img.image_name,
        original_filename=img.original_filename,
        stored_filename=img.stored_filename,
        content_type=img.content_type,
        size=img.size,
        created_at=img.created_at,
        likes_count=0,
        liked_by_user=False,
        image_url=image_url,
    )


@app.get("/images", response_model=List[ImageOut])
async def list_images(
    request: Request,
    page: int = 1,
    limit: int = 20,
    sort: str = "recent",  # 'trending' | 'popular' | 'recent'
    user_hash: Optional[str] = None,
):
    """
    Paginated list for infinite scroll.
    Query params:
      - page (1-based)
      - limit
      - sort: trending | popular | recent
      - user_hash (optional): to mark liked_by_user flags
    Returns up to `limit` items (does not return has_more; client can request next page).
    """
    page = max(1, page)
    limit = max(1, min(100, limit))
    skip = (page - 1) * limit

    def _db_work():
        db = SessionLocal()
        try:
            images = []
            # recent: order by created_at desc
            if sort == "recent":
                rows = (
                    db.execute(
                        select(Image)
                        .order_by(Image.created_at.desc())
                        .offset(skip)
                        .limit(limit)
                    )
                    .scalars()
                    .all()
                )
                images = rows
            elif sort == "popular":
                stmt = (
                    select(Image, func.count(Like.id).label("likes"))
                    .outerjoin(Like, Like.image_id == Image.id)
                    .group_by(Image.id)
                    .order_by(desc("likes"))
                    .offset(skip)
                    .limit(limit)
                )
                rows = db.execute(stmt).all()
                images = [r[0] for r in rows]
            elif sort == "trending":
                cutoff = datetime.utcnow() - timedelta(days=7)
                # use a correlated subquery to count likes in the last 7 days per image
                likes_week_subq = (
                    select(func.count(Like.id))
                    .where(Like.image_id == Image.id, Like.created_at >= cutoff)
                    .scalar_subquery()
                )
                stmt = (
                    select(Image, likes_week_subq.label("likes_week"))
                    .order_by(desc("likes_week"))
                    .offset(skip)
                    .limit(limit)
                )
                rows = db.execute(stmt).all()
                images = [r[0] for r in rows]
            else:
                # fallback to recent
                rows = (
                    db.execute(
                        select(Image)
                        .order_by(Image.created_at.desc())
                        .offset(skip)
                        .limit(limit)
                    )
                    .scalars()
                    .all()
                )
                images = rows

            ids = [img.id for img in images]
            # total likes per image
            total_likes_map = _get_total_likes_for_ids(db, ids)
            # which of these ids the user has liked
            liked_ids = (
                _get_liked_ids_by_user(db, ids, user_hash) if user_hash else set()
            )

            # build response payload list
            result = []
            base = str(request.base_url).rstrip("/")
            for img in images:
                image_url = base + f"/images/{img.stored_filename}"
                result.append(
                    ImageOut(
                        id=img.id,
                        author_name=img.author_name,
                        image_name=img.image_name,
                        original_filename=img.original_filename,
                        stored_filename=img.stored_filename,
                        content_type=img.content_type,
                        size=img.size,
                        created_at=img.created_at,
                        likes_count=int(total_likes_map.get(img.id, 0)),
                        liked_by_user=img.id in liked_ids,
                        image_url=image_url,
                    )
                )
            return result
        finally:
            db.close()

    res = await run_in_threadpool(_db_work)
    return res


@app.post("/api/images/{image_id}/like")
async def like_image(image_id: int, action: LikeAction):
    """
    Like/unlike an image.
    Body: { "user_hash": "...", "action": "like" | "unlike" }
    Returns updated counts and liked_by_user.
    """
    if not action.user_hash or action.action not in ("like", "unlike"):
        raise HTTPException(status_code=400, detail="Invalid payload")

    def _db():
        db = SessionLocal()
        try:
            img = db.get(Image, image_id)
            if not img:
                raise HTTPException(status_code=404, detail="Image not found")

            if action.action == "like":
                like = Like(
                    image_id=image_id,
                    user_hash=action.user_hash,
                    created_at=datetime.utcnow(),
                )
                db.add(like)
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()  # already liked
                # compute total likes
                total = db.execute(
                    select(func.count(Like.id)).where(Like.image_id == image_id)
                ).scalar_one()
                liked_by_user = True
            else:  # unlike
                stmt = delete(Like).where(
                    Like.image_id == image_id, Like.user_hash == action.user_hash
                )
                db.execute(stmt)
                db.commit()
                total = db.execute(
                    select(func.count(Like.id)).where(Like.image_id == image_id)
                ).scalar_one()
                liked_by_user = False

            return {
                "image_id": image_id,
                "likes_count": int(total),
                "liked_by_user": liked_by_user,
            }
        finally:
            db.close()

    return await run_in_threadpool(_db)


@app.get("/")
def health():
    return {"ok": True}
