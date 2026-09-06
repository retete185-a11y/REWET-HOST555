import secrets
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime
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
# SESSION MODEL
# =====================================================

class SessionModel(Base):

    __tablename__ = "sessions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    token = Column(
        String(128),
        unique=True,
        nullable=False,
        index=True
    )

    user_id = Column(
        Integer,
        nullable=False,
        index=True
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )


# =====================================================
# CREATE TABLES
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
# REQUEST MODELS
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

    username_exists = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if username_exists:
        raise HTTPException(
            status_code=400,
            detail="Это имя пользователя уже занято"
        )

    email_exists = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if email_exists:
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

    # Удаляем старые сессии пользователя
    db.query(SessionModel).filter(
        SessionModel.user_id == user.id
    ).delete()

    # Создаём новый токен
    token = secrets.token_urlsafe(64)

    expires = datetime.utcnow() + timedelta(
        days=30
    )

    session = SessionModel(
        token=token,
        user_id=user.id,
        expires_at=expires
    )

    db.add(session)
    db.commit()

    # Сохраняем авторизацию на 30 дней
    response.set_cookie(
        key="rewet_session",
        value=token,
        max_age=60 * 60 * 24 * 30,
        expires=60 * 60 * 24 * 30,
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

    token = request.cookies.get(
        "rewet_session"
    )

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Вы не авторизованы"
        )

    session = (
        db.query(SessionModel)
        .filter(SessionModel.token == token)
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Сессия недействительна"
        )

    if session.expires_at < datetime.utcnow():

        db.delete(session)
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Сессия истекла"
        )

    user = (
        db.query(User)
        .filter(User.id == session.user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Пользователь не найден"
        )

    return {
        "status": "success",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }


# =====================================================
# LOGOUT
# =====================================================

@app.post("/api/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):

    token = request.cookies.get(
        "rewet_session"
    )

    if token:

        session = (
            db.query(SessionModel)
            .filter(SessionModel.token == token)
            .first()
        )

        if session:
            db.delete(session)
            db.commit()

    response.delete_cookie(
        key="rewet_session"
    )

    return {
        "status": "success",
        "message": "Вы вышли из аккаунта"
    }
