import os
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rewet-host.onrender.com"
    ],
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
    schemes=["bcrypt"],
    deprecated="auto"
)


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
# ROOT
# =====================================================

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "REWET HOST API"
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok"
    }


# =====================================================
# REGISTER
# =====================================================

@app.post("/api/register")
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db)
):

    username = data.username.strip()
    email = data.email.strip().lower()
    password = data.password

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Имя пользователя должно содержать минимум 3 символа"
        )

    if len(username) > 24:
        raise HTTPException(
            status_code=400,
            detail="Имя пользователя слишком длинное"
        )

    if "@" not in email:
        raise HTTPException(
            status_code=400,
            detail="Введите корректную почту"
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Пароль должен содержать минимум 6 символов"
        )

    existing_username = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Это имя пользователя уже занято"
        )

    existing_email = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Эта почта уже зарегистрирована"
        )

    user = User(
        username=username,
        email=email,
        password_hash=pwd_context.hash(password),
        created_at=datetime.utcnow()
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": "Аккаунт успешно создан",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
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

    user = (
        db.query(User)
        .filter(
            (User.username == login_value) |
            (User.email == login_value.lower())
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Неверный логин или пароль"
        )

    if not pwd_context.verify(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверный логин или пароль"
        )

    # Создаём безопасный идентификатор сессии
    session_token = secrets.token_urlsafe(48)

    # Пока храним токен в cookie.
    # Позже вынесем сессии в отдельную таблицу.
    response.set_cookie(
        key="rewet_session",
        value=session_token,
        max_age=60 * 60 * 24 * 30,
        httponly=True,
        secure=True,
        samesite="lax"
    )

    return {
        "status": "success",
        "message": "Вы успешно вошли",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }


# =====================================================
# CURRENT USER
# =====================================================

@app.get("/api/me")
def me(
    request: Request,
    db: Session = Depends(get_db)
):

    session_token = request.cookies.get(
        "rewet_session"
    )

    if not session_token:
        raise HTTPException(
            status_code=401,
            detail="Вы не авторизованы"
        )

    # Временная проверка наличия cookie.
    # Полноценную таблицу сессий добавим следующим этапом.
    return {
        "status": "success",
        "message": "Сессия найдена"
    }


# =====================================================
# LOGOUT
# =====================================================

@app.post("/api/logout")
def logout(response: Response):

    response.delete_cookie(
        key="rewet_session"
    )

    return {
        "status": "success",
        "message": "Вы вышли из аккаунта"
        }
