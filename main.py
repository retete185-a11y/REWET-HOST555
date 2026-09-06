import os
import re
import secrets
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from database import Base, engine, get_db
from models import User


# =====================================================
# REWET HOST API
# =====================================================

app = FastAPI(
    title="REWET HOST API",
    version="1.0.0"
)


# =====================================================
# CORS
# =====================================================

ALLOWED_ORIGINS = [
    "https://retete185-a11y.github.io",
    "https://rewet-host-9phs.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# DATABASE
# =====================================================

Base.metadata.create_all(bind=engine)


# =====================================================
# PASSWORD HASH
# =====================================================

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)


# =====================================================
# SESSION SETTINGS
# =====================================================

SESSION_COOKIE = "rewet_session"
USER_COOKIE = "rewet_user_id"

SESSION_DAYS = 30


# =====================================================
# SCHEMAS
# =====================================================

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    login: str
    password: str


# =====================================================
# HELPERS
# =====================================================

def normalize_username(username: str) -> str:
    return username.strip()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_username(username: str):
    if not username:
        raise HTTPException(
            status_code=400,
            detail="Введите имя пользователя."
        )

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Имя пользователя должно содержать минимум 3 символа."
        )

    if len(username) > 24:
        raise HTTPException(
            status_code=400,
            detail="Имя пользователя слишком длинное."
        )

    if not re.fullmatch(r"[A-Za-zА-Яа-яЁё0-9_]+", username):
        raise HTTPException(
            status_code=400,
            detail="Имя пользователя может содержать только буквы, цифры и _."
        )


def validate_email(email: str):
    if not email:
        raise HTTPException(
            status_code=400,
            detail="Введите email."
        )

    if len(email) > 255:
        raise HTTPException(
            status_code=400,
            detail="Email слишком длинный."
        )

    if not re.fullmatch(
        r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        email
    ):
        raise HTTPException(
            status_code=400,
            detail="Введите корректный email."
        )


def validate_password(password: str):
    if not password:
        raise HTTPException(
            status_code=400,
            detail="Введите пароль."
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Пароль должен содержать минимум 6 символов."
        )

    if len(password) > 128:
        raise HTTPException(
            status_code=400,
            detail="Пароль слишком длинный."
        )


def create_session(response: Response, user: User):
    session_token = secrets.token_urlsafe(48)

    response.set_cookie(
        key=SESSION_COOKIE,
        value=session_token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        expires=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/"
    )

    response.set_cookie(
        key=USER_COOKIE,
        value=str(user.id),
        max_age=SESSION_DAYS * 24 * 60 * 60,
        expires=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/"
    )


def get_current_user(
    request: Request,
    db: Session
):
    session = request.cookies.get(SESSION_COOKIE)
    user_id = request.cookies.get(USER_COOKIE)

    if not session or not user_id:
        return None

    try:
        user_id = int(user_id)
    except ValueError:
        return None

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    return user


# =====================================================
# ROOT
# =====================================================

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "REWET HOST API",
        "version": "1.0.0"
    }


# =====================================================
# HEALTH
# =====================================================

@app.get("/health")
def health():
    return {
        "status": "ok"
    }


@app.get("/api/health")
def api_health():
    return {
        "status": "ok",
        "service": "REWET HOST API"
    }


# =====================================================
# API INFO
# =====================================================

@app.get("/api")
def api_info():
    return {
        "name": "REWET HOST API",
        "version": "1.0.0",
        "status": "online"
    }


# =====================================================
# REGISTER
# =====================================================

@app.post("/api/register")
def register(
    data: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db)
):

    username = normalize_username(data.username)
    email = normalize_email(data.email)
    password = data.password

    validate_username(username)
    validate_email(email)
    validate_password(password)

    existing_username = db.query(User).filter(
        User.username == username
    ).first()

    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Это имя пользователя уже занято."
        )

    existing_email = db.query(User).filter(
        User.email == email
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Этот email уже зарегистрирован."
        )

    password_hash = pwd_context.hash(password)

    user = User(
        username=username,
        email=email,
        password_hash=password_hash
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    create_session(response, user)

    return {
        "success": True,
        "message": "Аккаунт успешно создан.",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "created_at": user.created_at.isoformat()
            if user.created_at else None
        }
    }


# =====================================================
# LOGIN
# =====================================================

@app.post("/api/login")
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):

    login_value = data.login.strip()
    password = data.password

    if not login_value:
        raise HTTPException(
            status_code=400,
            detail="Введите логин или email."
        )

    if not password:
        raise HTTPException(
            status_code=400,
            detail="Введите пароль."
        )

    user = None

    # Проверяем email
    if "@" in login_value:
        user = db.query(User).filter(
            User.email == login_value.lower()
        ).first()

    # Если по email не нашли — проверяем username
    if user is None:
        user = db.query(User).filter(
            User.username == login_value
        ).first()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Неверный логин или пароль."
        )

    if not pwd_context.verify(
        password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверный логин или пароль."
        )

    create_session(response, user)

    return {
        "success": True,
        "message": "Вы успешно вошли.",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "created_at": user.created_at.isoformat()
            if user.created_at else None
        }
    }


# =====================================================
# LOGOUT
# =====================================================

@app.post("/api/logout")
def logout(response: Response):

    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        secure=True,
        httponly=True,
        samesite="none"
    )

    response.delete_cookie(
        key=USER_COOKIE,
        path="/",
        secure=True,
        httponly=True,
        samesite="none"
    )

    return {
        "success": True,
        "message": "Вы вышли из аккаунта."
    }


# =====================================================
# CURRENT USER
# =====================================================

@app.get("/api/me")
def me(
    request: Request,
    db: Session = Depends(get_db)
):

    user = get_current_user(
        request,
        db
    )

    if user is None:
        return {
            "authenticated": False,
            "user": None
        }

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "created_at": user.created_at.isoformat()
            if user.created_at else None
        }
    }


# =====================================================
# PROFILE
# =====================================================

@app.get("/api/profile")
def profile(
    request: Request,
    db: Session = Depends(get_db)
):

    user = get_current_user(
        request,
        db
    )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Вы не авторизованы."
        )

    return {
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "created_at": user.created_at.isoformat()
            if user.created_at else None
        }
    }


# =====================================================
# CHECK USERNAME
# =====================================================

@app.get("/api/check-username")
def check_username(
    username: str,
    db: Session = Depends(get_db)
):

    username = normalize_username(username)

    if not username:
        return {
            "available": False
        }

    existing = db.query(User).filter(
        User.username == username
    ).first()

    return {
        "available": existing is None
    }


# =====================================================
# CHECK EMAIL
# =====================================================

@app.get("/api/check-email")
def check_email(
    email: str,
    db: Session = Depends(get_db)
):

    email = normalize_email(email)

    if not email:
        return {
            "available": False
        }

    existing = db.query(User).filter(
        User.email == email
    ).first()

    return {
        "available": existing is None
    }


# =====================================================
# END
# =====================================================
