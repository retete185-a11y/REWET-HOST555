import secrets
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from database import Base, engine, get_db
from models import User


# ============================================================
# REWET HOST API
# ============================================================

app = FastAPI(
    title="REWET HOST API",
    version="1.0.0"
)


# ============================================================
# CORS — GITHUB PAGES
# ============================================================

ALLOWED_ORIGINS = [
    "https://retete185-a11y.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# PASSWORDS
# ============================================================

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)


# ============================================================
# COOKIES
# ============================================================

SESSION_COOKIE = "rewet_session"
USER_COOKIE = "rewet_user_id"

SESSION_MAX_AGE = 60 * 60 * 24 * 30


# ============================================================
# MODELS
# ============================================================

class RegisterRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=24
    )

    email: str = Field(
        min_length=5,
        max_length=255
    )

    password: str = Field(
        min_length=6,
        max_length=128
    )


class LoginRequest(BaseModel):
    login: str = Field(
        min_length=3,
        max_length=255
    )

    password: str = Field(
        min_length=1,
        max_length=128
    )


# ============================================================
# HELPERS
# ============================================================

def normalize_username(username: str) -> str:
    return username.strip()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(
    password: str,
    password_hash: str
) -> bool:
    try:
        return pwd_context.verify(
            password,
            password_hash
        )
    except Exception:
        return False


def create_session_token() -> str:
    return secrets.token_urlsafe(48)


def serialize_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "created_at": (
            user.created_at.isoformat()
            if user.created_at
            else None
        )
    }


def set_auth_cookies(
    response: Response,
    user_id: int
):
    token = create_session_token()

    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="none",
        path="/"
    )

    response.set_cookie(
        key=USER_COOKIE,
        value=str(user_id),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="none",
        path="/"
    )


# ============================================================
# CURRENT USER
# ============================================================

def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    token = request.cookies.get(SESSION_COOKIE)
    user_id = request.cookies.get(USER_COOKIE)

    if not token or not user_id:
        raise HTTPException(
            status_code=401,
            detail="Не авторизован"
        )

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Недействительная сессия"
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Пользователь не найден"
        )

    return user


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "success": True,
        "name": "REWET HOST",
        "status": "online",
        "version": "1.0.0"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "ok"
    }


@app.get("/api/health")
def api_health():
    return {
        "success": True,
        "status": "online",
        "service": "REWET HOST API"
    }


# ============================================================
# REGISTER
# ============================================================

@app.post("/api/register")
def register(
    data: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    username = normalize_username(data.username)
    email = normalize_email(data.email)

    # --------------------------------------------------------
    # USERNAME
    # --------------------------------------------------------

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Username должен содержать минимум 3 символа"
        )

    allowed_chars = (
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789_-"
    )

    if not all(
        char in allowed_chars
        for char in username
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Username может содержать только "
                "латинские буквы, цифры, _ и -"
            )
        )

    # --------------------------------------------------------
    # EMAIL
    # --------------------------------------------------------

    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(
            status_code=400,
            detail="Введите корректный email"
        )

    # --------------------------------------------------------
    # PASSWORD
    # --------------------------------------------------------

    if len(data.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Пароль должен содержать минимум 6 символов"
        )

    # --------------------------------------------------------
    # USERNAME EXISTS
    # --------------------------------------------------------

    existing_username = (
        db.query(User)
        .filter(User.username.ilike(username))
        .first()
    )

    if existing_username:
        raise HTTPException(
            status_code=409,
            detail="Это имя пользователя уже занято"
        )

    # --------------------------------------------------------
    # EMAIL EXISTS
    # --------------------------------------------------------

    existing_email = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="Этот email уже зарегистрирован"
        )

    # --------------------------------------------------------
    # CREATE USER
    # --------------------------------------------------------

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(data.password),
        created_at=datetime.utcnow()
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Не удалось создать аккаунт"
        )

    # --------------------------------------------------------
    # AUTO LOGIN
    # --------------------------------------------------------

    set_auth_cookies(
        response,
        user.id
    )

    return {
        "success": True,
        "message": "Аккаунт успешно создан",
        "user": serialize_user(user)
    }


# ============================================================
# LOGIN
# ============================================================

@app.post("/api/login")
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    login_value = data.login.strip()

    user = (
        db.query(User)
        .filter(
            (User.username.ilike(login_value))
            |
            (User.email == login_value.lower())
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Неверный логин или пароль"
        )

    if not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверный логин или пароль"
        )

    set_auth_cookies(
        response,
        user.id
    )

    return {
        "success": True,
        "message": "Вы успешно вошли",
        "user": serialize_user(user)
    }


# ============================================================
# LOGOUT
# ============================================================

@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/"
    )

    response.delete_cookie(
        key=USER_COOKIE,
        path="/"
    )

    return {
        "success": True,
        "message": "Вы вышли из аккаунта"
    }


# ============================================================
# ME
# ============================================================

@app.get("/api/me")
def me(
    user: User = Depends(get_current_user)
):
    return {
        "success": True,
        "authenticated": True,
        "user": serialize_user(user)
    }


# ============================================================
# PROFILE
# ============================================================

@app.get("/api/profile")
def profile(
    user: User = Depends(get_current_user)
):
    return {
        "success": True,
        "user": serialize_user(user)
    }


# ============================================================
# CHECK USERNAME
# ============================================================

@app.get("/api/check-username")
def check_username(
    username: str,
    db: Session = Depends(get_db)
):
    username = normalize_username(username)

    user = (
        db.query(User)
        .filter(User.username.ilike(username))
        .first()
    )

    return {
        "success": True,
        "available": user is None
    }


# ============================================================
# CHECK EMAIL
# ============================================================

@app.get("/api/check-email")
def check_email(
    email: str,
    db: Session = Depends(get_db)
):
    email = normalize_email(email)

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    return {
        "success": True,
        "available": user is None
    }
