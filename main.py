import os
import secrets
import re

from datetime import datetime, timedelta

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Response,
    Request
)

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, EmailStr

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime
)

from sqlalchemy.orm import Session

from passlib.context import CryptContext

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from database import Base, engine, get_db
from models import User


# =====================================================
# APP
# =====================================================

app = FastAPI(
    title="REWET HOST API",
    version="2.0.0"
)


# =====================================================
# SETTINGS
# =====================================================

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "https://rewet-host.onrender.com"
)

GOOGLE_CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID",
    ""
)


# =====================================================
# CORS
# =====================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        FRONTEND_URL
    ],

    allow_credentials=True,

    allow_methods=[
        "*"
    ],

    allow_headers=[
        "*"
    ]
)


# =====================================================
# PASSWORDS
# =====================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


# =====================================================
# SESSION MODEL
# =====================================================

class SessionModel(Base):

    __tablename__ = "sessions"

    id = Column(
        Integer,
        primary_key=True
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
# DATABASE
# =====================================================

Base.metadata.create_all(
    bind=engine
)


# =====================================================
# REQUEST MODELS
# =====================================================

class RegisterRequest(BaseModel):

    username: str
    email: EmailStr
    password: str
    password_confirm: str


class LoginRequest(BaseModel):

    login: str
    password: str


class GoogleLoginRequest(BaseModel):

    credential: str


# =====================================================
# HELPERS
# =====================================================

def create_session(
    response: Response,
    user_id: int,
    db: Session
):

    token = secrets.token_urlsafe(64)

    expires_at = (
        datetime.utcnow()
        + timedelta(days=30)
    )

    session = SessionModel(
        token=token,
        user_id=user_id,
        expires_at=expires_at
    )

    db.add(session)
    db.commit()

    response.set_cookie(
        key="rewet_session",
        value=token,
        max_age=60 * 60 * 24 * 30,
        httponly=True,
        secure=True,
        samesite="none",
        path="/"
    )

    return token


def username_is_valid(username: str):

    return bool(
        re.fullmatch(
            r"[A-Za-zА-Яа-яЁё0-9_.-]+",
            username
        )
    )


def generate_google_username(
    email: str,
    db: Session
):

    base = email.split("@")[0]

    base = re.sub(
        r"[^A-Za-z0-9_]",
        "_",
        base
    )

    base = base[:18]

    if len(base) < 3:
        base = "google_user"

    username = base

    number = 1

    while db.query(User).filter(
        User.username == username
    ).first():

        username = (
            f"{base}_{number}"
        )

        number += 1

    return username


# =====================================================
# ROOT
# =====================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "service": "REWET HOST API",
        "version": "2.0.0"
    }


# =====================================================
# HEALTH
# =====================================================

@app.get("/api/health")
def health():

    return {
        "status": "ok",
        "service": "REWET HOST API"
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

    email = (
        str(data.email)
        .strip()
        .lower()
    )

    password = data.password

    password_confirm = (
        data.password_confirm
    )


    # -----------------------------
    # USERNAME
    # -----------------------------

    if len(username) < 3:

        raise HTTPException(
            status_code=400,
            detail="Имя пользователя должно содержать минимум 3 символа."
        )


    if len(username) > 24:

        raise HTTPException(
            status_code=400,
            detail="Имя пользователя не должно быть длиннее 24 символов."
        )


    if not username_is_valid(username):

        raise HTTPException(
            status_code=400,
            detail="В имени пользователя разрешены только буквы, цифры, _, . и -."
        )


    # -----------------------------
    # PASSWORD
    # -----------------------------

    if len(password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Пароль должен содержать минимум 6 символов."
        )


    if len(password.encode("utf-8")) > 72:

        raise HTTPException(
            status_code=400,
            detail="Пароль слишком длинный."
        )


    if password != password_confirm:

        raise HTTPException(
            status_code=400,
            detail="Пароли не совпадают."
        )


    # -----------------------------
    # USERNAME EXISTS
    # -----------------------------

    existing_username = (
        db.query(User)
        .filter(
            User.username == username
        )
        .first()
    )


    if existing_username:

        raise HTTPException(
            status_code=400,
            detail="Это имя пользователя уже занято."
        )


    # -----------------------------
    # EMAIL EXISTS
    # -----------------------------

    existing_email = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )


    if existing_email:

        raise HTTPException(
            status_code=400,
            detail="Этот E-mail уже зарегистрирован."
        )


    # -----------------------------
    # HASH
    # -----------------------------

    try:

        password_hash = (
            pwd_context.hash(password)
        )

    except Exception as error:

        print(
            "PASSWORD HASH ERROR:",
            repr(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Ошибка создания пароля на сервере."
        )


    # -----------------------------
    # CREATE USER
    # -----------------------------

    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        created_at=datetime.utcnow()
    )


    try:

        db.add(user)

        db.commit()

        db.refresh(user)

    except Exception as error:

        db.rollback()

        print(
            "REGISTER DATABASE ERROR:",
            repr(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Не удалось сохранить аккаунт."
        )


    return {
        "status": "success",

        "message": "Аккаунт успешно создан.",

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

    login_value = (
        data.login.strip()
    )


    user = (
        db.query(User)
        .filter(
            (User.username == login_value)
            |
            (
                User.email
                == login_value.lower()
            )
        )
        .first()
    )


    if not user:

        raise HTTPException(
            status_code=401,
            detail="Неверный E-mail/логин или пароль."
        )


    try:

        password_valid = (
            pwd_context.verify(
                data.password,
                user.password_hash
            )
        )

    except Exception as error:

        print(
            "PASSWORD VERIFY ERROR:",
            repr(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Ошибка проверки пароля."
        )


    if not password_valid:

        raise HTTPException(
            status_code=401,
            detail="Неверный E-mail/логин или пароль."
        )


    create_session(
        response,
        user.id,
        db
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
# GOOGLE LOGIN
# =====================================================

@app.post("/api/auth/google")
def google_login(
    data: GoogleLoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):

    if not GOOGLE_CLIENT_ID:

        raise HTTPException(
            status_code=503,
            detail="Google авторизация пока не настроена. Добавьте GOOGLE_CLIENT_ID в Render."
        )


    if not data.credential:

        raise HTTPException(
            status_code=400,
            detail="Google credential отсутствует."
        )


    # -----------------------------
    # VERIFY GOOGLE TOKEN
    # -----------------------------

    try:

        google_user = id_token.verify_oauth2_token(
            data.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )

    except Exception as error:

        print(
            "GOOGLE TOKEN ERROR:",
            repr(error)
        )

        raise HTTPException(
            status_code=401,
            detail="Не удалось подтвердить Google аккаунт."
        )


    google_sub = google_user.get(
        "sub"
    )

    email = google_user.get(
        "email"
    )

    email_verified = google_user.get(
        "email_verified",
        False
    )


    if not google_sub:

        raise HTTPException(
            status_code=401,
            detail="Google не вернул идентификатор аккаунта."
        )


    if not email:

        raise HTTPException(
            status_code=400,
            detail="Google не вернул E-mail."
        )


    if not email_verified:

        raise HTTPException(
            status_code=400,
            detail="Google E-mail не подтверждён."
        )


    email = email.lower().strip()


    # =================================================
    # НАХОДИМ ПО EMAIL
    # =================================================

    user = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )


    # =================================================
    # ЕСЛИ НЕТ — СОЗДАЁМ
    # =================================================

    if not user:

        username = generate_google_username(
            email,
            db
        )


        random_password = secrets.token_urlsafe(
            32
        )


        user = User(
            username=username,
            email=email,
            password_hash=pwd_context.hash(
                random_password
            ),
            created_at=datetime.utcnow()
        )


        try:

            db.add(user)

            db.commit()

            db.refresh(user)

        except Exception as error:

            db.rollback()

            print(
                "GOOGLE USER CREATE ERROR:",
                repr(error)
            )

            raise HTTPException(
                status_code=500,
                detail="Не удалось создать Google аккаунт."
            )


    # =================================================
    # CREATE SESSION
    # =================================================

    create_session(
        response,
        user.id,
        db
    )


    return {
        "status": "success",

        "provider": "google",

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
            detail="Не авторизован."
        )


    session = (
        db.query(SessionModel)
        .filter(
            SessionModel.token == token
        )
        .first()
    )


    if not session:

        raise HTTPException(
            status_code=401,
            detail="Сессия недействительна."
        )


    if (
        session.expires_at
        < datetime.utcnow()
    ):

        db.delete(session)

        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Сессия истекла."
        )


    user = (
        db.query(User)
        .filter(
            User.id == session.user_id
        )
        .first()
    )


    if not user:

        raise HTTPException(
            status_code=401,
            detail="Пользователь не найден."
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
            .filter(
                SessionModel.token == token
            )
            .first()
        )


        if session:

            db.delete(session)

            db.commit()


    response.delete_cookie(
        key="rewet_session",
        path="/"
    )


    return {
        "status": "success",
        "message": "Вы вышли из аккаунта."
    }
