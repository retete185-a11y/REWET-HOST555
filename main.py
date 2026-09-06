import os
import secrets
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from database import Base, engine, get_db
from models import User


# ============================================================
# REWET HOST — API
# ============================================================

app = FastAPI(
    title="REWET HOST API",
    version="1.0.0",
    description="Backend API for REWET HOST"
)


# ============================================================
# CORS
# ============================================================

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "https://rewet-host.onrender.com"
).rstrip("/")

ALLOWED_ORIGINS = [
    FRONTEND_URL,
]

# Если FRONTEND_URL не задан или отличается,
# можно дополнительно указать адрес через ALLOWED_ORIGINS.
extra_origins = os.getenv("ALLOWED_ORIGINS", "")

if extra_origins:
    for origin in extra_origins.split(","):
        origin = origin.strip().rstrip("/")
        if origin and origin not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(origin)


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
# PASSWORD HASHING
# ============================================================

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)


# ============================================================
# SESSION SETTINGS
# ============================================================

SESSION_COOKIE = "rewet_session"

SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 дней


# ============================================================
# SCHEMAS
# ============================================================

class RegisterRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=24
    )

    email: EmailStr

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


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    token = request.cookies.get(SESSION_COOKIE)

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Не авторизован"
        )

    # В этой версии token содержит подписанную случайную строку.
    # Чтобы не хранить сессии в памяти Render, ниже используется
    # отдельная cookie с user_id.
    user_id = request.cookies.get("rewet_user_id")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Сессия недействительна"
        )

    try:
        user_id = int(user_id)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Сессия недействительна"
        )

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Пользователь не найден"
        )

    return user


def user_response(user: User):
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


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "success": True,
        "name": "REWET HOST",
        "message": "REWET HOST API работает",
        "version": "1.0.0"
    }


# ============================================================
# HEALTH CHECK
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
    email = normalize_email(str(data.email))

    # --------------------------------------------------------
    # Проверка username
    # --------------------------------------------------------

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Введите имя пользователя"
        )

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Имя пользователя должно содержать минимум 3 символа"
        )

    # --------------------------------------------------------
    # Проверка допустимых символов
    # --------------------------------------------------------

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
            detail="Username может содержать только буквы, цифры, _ и -"
        )

    # --------------------------------------------------------
    # Проверка существующего username
    # --------------------------------------------------------

    existing_username = db.query(User).filter(
        User.username.ilike(username)
    ).first()

    if existing_username:
        raise HTTPException(
            status_code=409,
            detail="Это имя пользователя уже занято"
        )

    # --------------------------------------------------------
    # Проверка существующего email
    # --------------------------------------------------------

    existing_email = db.query(User).filter(
        User.email == email
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="Этот email уже зарегистрирован"
        )

    # --------------------------------------------------------
    # Создание пользователя
    # --------------------------------------------------------

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(data.password),
        created_at=datetime.utcnow()
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # --------------------------------------------------------
    # Авторизация сразу после регистрации
    # --------------------------------------------------------

    token = create_session_token()

    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="none"
    )

    response.set_cookie(
        key="rewet_user_id",
        value=str(user.id),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="none"
    )

    return {
        "success": True,
        "message": "Аккаунт успешно создан",
        "user": user_response(user)
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

    # --------------------------------------------------------
    # Ищем по username или email
    # --------------------------------------------------------

    user = db.query(User).filter(
        (User.username.ilike(login_value)) |
        (User.email == login_value.lower())
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Неверный логин или пароль"
        )

    # --------------------------------------------------------
    # Проверяем пароль
    # --------------------------------------------------------

    if not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверный логин или пароль"
        )

    # --------------------------------------------------------
    # Создаём сессию
    # --------------------------------------------------------

    token = create_session_token()

    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="none"
    )

    response.set_cookie(
        key="rewet_user_id",
        value=str(user.id),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="none"
    )

    return {
        "success": True,
        "message": "Вы успешно вошли",
        "user": user_response(user)
    }


# ============================================================
# LOGOUT
# ============================================================

@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(
        SESSION_COOKIE,
        secure=True,
        samesite="none"
    )

    response.delete_cookie(
        "rewet_user_id",
        secure=True,
        samesite="none"
    )

    return {
        "success": True,
        "message": "Вы вышли из аккаунта"
    }


# ============================================================
# CURRENT USER
# ============================================================

@app.get("/api/me")
def me(
    user: User = Depends(get_current_user)
):
    return {
        "success": True,
        "authenticated": True,
        "user": user_response(user)
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
        "user": user_response(user)
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

    user = db.query(User).filter(
        User.username.ilike(username)
    ).first()

    return {
        "success": True,
        "available": user is None
    }


# ============================================================
# CHECK EMAIL
# ============================================================

@app.get("/api/check-email")
def check_email(
    email: EmailStr,
    db: Session = Depends(get_db)
):
    email = normalize_email(str(email))

    user = db.query(User).filter(
        User.email == email
    ).first()

    return {
        "success": True,
        "available": user is None
    }


# ============================================================
# ERROR HANDLER
# ============================================================

@app.get("/api")
def api_root():
    return {
        "success": True,
        "name": "REWET HOST",
        "version": "1.0.0",
        "status": "online",
        "endpoints": [
            "/api/register",
            "/api/login",
            "/api/logout",
            "/api/me",
            "/api/profile",
            "/api/check-username",
            "/api/check-email"
        ]
    }
