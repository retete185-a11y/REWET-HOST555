import os
import secrets
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from sqlalchemy import text

from database import Base, engine, get_db
from models import User, PromoCode, PromoUse


# =====================================================
# НАСТРОЙКИ
# =====================================================

API_TITLE = "REWET HOST API"

# ID владельца REWET HOST
OWNER_ADMIN_ID = int(
    os.getenv("ADMIN_USER_ID", "421573")
)

SESSION_DAYS = 30


# =====================================================
# FASTAPI
# =====================================================

app = FastAPI(
    title=API_TITLE,
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
# PASSWORD
# =====================================================

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)


# =====================================================
# DATABASE
# =====================================================

Base.metadata.create_all(bind=engine)


# =====================================================
# МИГРАЦИЯ USERS
# =====================================================

def ensure_user_columns():

    try:

        with engine.begin() as conn:

            result = conn.execute(
                text("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'users'
                """)
            )

            columns = {
                row[0]
                for row in result.fetchall()
            }

            if "balance" not in columns:

                conn.execute(
                    text("""
                        ALTER TABLE users
                        ADD COLUMN balance FLOAT NOT NULL DEFAULT 0
                    """)
                )

            if "is_admin" not in columns:

                conn.execute(
                    text("""
                        ALTER TABLE users
                        ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE
                    """)
                )

    except Exception as e:

        print(
            "DB migration warning:",
            e
        )


ensure_user_columns()


# =====================================================
# PYDANTIC
# =====================================================

class RegisterRequest(BaseModel):

    username: str
    email: str
    password: str


class LoginRequest(BaseModel):

    login: str
    password: str


class PromoCreateRequest(BaseModel):

    code: str
    bonus: float
    max_uses: int = 1


class PromoActivateRequest(BaseModel):

    code: str


class BalanceRequest(BaseModel):

    username: str
    amount: float
    reason: str = ""


class AdminRequest(BaseModel):

    username: str


# =====================================================
# HELPERS
# =====================================================

def normalize_username(username: str):

    return username.strip()


def normalize_email(email: str):

    return email.strip().lower()


def validate_username(username: str):

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Ник должен содержать минимум 3 символа"
        )

    if len(username) > 24:
        raise HTTPException(
            status_code=400,
            detail="Ник слишком длинный"
        )


def validate_email(email: str):

    if "@" not in email:

        raise HTTPException(
            status_code=400,
            detail="Некорректный E-Mail"
        )


def validate_password(password: str):

    if len(password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Пароль должен содержать минимум 6 символов"
        )


def create_session(response: Response, user_id: int):

    token = secrets.token_urlsafe(48)

    response.set_cookie(
        key="rewet_session",
        value=token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/"
    )

    response.set_cookie(
        key="rewet_user_id",
        value=str(user_id),
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/"
    )


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):

    user_id = request.cookies.get(
        "rewet_user_id"
    )

    if not user_id:
        return None

    try:

        user_id = int(user_id)

    except ValueError:

        return None

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        return None

    # Автоматически выдаём владельцу админку
    if user.id == OWNER_ADMIN_ID and not user.is_admin:

        user.is_admin = True
        db.commit()
        db.refresh(user)

    return user


def require_user(
    request: Request,
    db: Session = Depends(get_db)
):

    user = get_current_user(
        request,
        db
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Требуется авторизация"
        )

    return user


def require_admin(
    request: Request,
    db: Session = Depends(get_db)
):

    user = get_current_user(
        request,
        db
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Требуется авторизация"
        )

    # Владелец всегда администратор
    if user.id == OWNER_ADMIN_ID:

        if not user.is_admin:

            user.is_admin = True
            db.commit()
            db.refresh(user)

        return user

    if not user.is_admin:

        raise HTTPException(
            status_code=403,
            detail="Доступ запрещён"
        )

    return user


# =====================================================
# ROOT
# =====================================================

@app.get("/")
def root():

    return {
        "name": "REWET HOST",
        "status": "online",
        "version": "1.0.0"
    }


@app.get("/health")
def health():

    return {
        "status": "ok"
    }


@app.get("/api/health")
def api_health():

    return {
        "status": "ok"
    }


@app.get("/api")
def api_root():

    return {
        "name": "REWET HOST API",
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

    username = normalize_username(
        data.username
    )

    email = normalize_email(
        data.email
    )

    validate_username(username)
    validate_email(email)
    validate_password(data.password)

    existing_username = db.query(User).filter(
        User.username == username
    ).first()

    if existing_username:

        raise HTTPException(
            status_code=400,
            detail="Этот ник уже занят"
        )

    existing_email = db.query(User).filter(
        User.email == email
    ).first()

    if existing_email:

        raise HTTPException(
            status_code=400,
            detail="Этот E-Mail уже зарегистрирован"
        )

    user = User(
        username=username,
        email=email,
        password_hash=pwd_context.hash(
            data.password
        ),
        balance=0,
        is_admin=False
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Если вдруг регистрация владельца
    if user.id == OWNER_ADMIN_ID:

        user.is_admin = True

        db.commit()
        db.refresh(user)

    create_session(
        response,
        user.id
    )

    return {
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "balance": user.balance,
            "is_admin": user.is_admin,
            "created_at": user.created_at
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

    user = db.query(User).filter(
        (User.username == login_value) |
        (User.email == login_value.lower())
    ).first()

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

    # Владелец автоматически получает админку
    if user.id == OWNER_ADMIN_ID:

        user.is_admin = True

        db.commit()
        db.refresh(user)

    create_session(
        response,
        user.id
    )

    return {
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "balance": user.balance,
            "is_admin": user.is_admin,
            "created_at": user.created_at
        }
    }


# =====================================================
# LOGOUT
# =====================================================

@app.post("/api/logout")
def logout(response: Response):

    response.delete_cookie(
        "rewet_session",
        path="/"
    )

    response.delete_cookie(
        "rewet_user_id",
        path="/"
    )

    return {
        "success": True
    }


# =====================================================
# ME
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

    if not user:

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
            "balance": user.balance,
            "is_admin": user.is_admin,
            "created_at": user.created_at
        }
    }


# =====================================================
# PROFILE
# =====================================================

@app.get("/api/profile")
def profile(
    user: User = Depends(require_user)
):

    return {
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "balance": user.balance,
            "is_admin": user.is_admin,
            "created_at": user.created_at
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

    username = normalize_username(
        username
    )

    user = db.query(User).filter(
        User.username == username
    ).first()

    return {
        "available": user is None
    }


# =====================================================
# CHECK EMAIL
# =====================================================

@app.get("/api/check-email")
def check_email(
    email: str,
    db: Session = Depends(get_db)
):

    email = normalize_email(
        email
    )

    user = db.query(User).filter(
        User.email == email
    ).first()

    return {
        "available": user is None
    }


# =====================================================
# ADMIN — USERS
# =====================================================

@app.get("/api/admin/users")
def admin_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):

    users = db.query(User).order_by(
        User.id.desc()
    ).all()

    return {
        "success": True,
        "users": [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "balance": user.balance,
                "is_admin": user.is_admin,
                "created_at": user.created_at
            }
            for user in users
        ]
    }


# =====================================================
# ADMIN — GIVE ADMIN BY NICK
# =====================================================

@app.post("/api/admin/users/admin")
def give_admin(
    data: AdminRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):

    username = data.username.strip()

    user = db.query(User).filter(
        User.username == username
    ).first()

    if not user:

        raise HTTPException(
            status_code=404,
            detail="Пользователь с таким ником не найден"
        )

    user.is_admin = True

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": f"Пользователь {user.username} теперь администратор",
        "user": {
            "id": user.id,
            "username": user.username,
            "is_admin": user.is_admin
        }
    }


# =====================================================
# ADMIN — REMOVE ADMIN BY NICK
# =====================================================

@app.delete("/api/admin/users/admin")
def remove_admin(
    username: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.username == username
    ).first()

    if not user:

        raise HTTPException(
            status_code=404,
            detail="Пользователь не найден"
        )

    # Нельзя снять админку с владельца
    if user.id == OWNER_ADMIN_ID:

        raise HTTPException(
            status_code=400,
            detail="Нельзя снять права владельца REWET HOST"
        )

    user.is_admin = False

    db.commit()

    return {
        "success": True,
        "message": f"Админка снята с {user.username}"
    }


# =====================================================
# ADMIN — GIVE BALANCE BY USERNAME
# =====================================================

@app.post("/api/admin/users/balance")
def give_balance(
    data: BalanceRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):

    username = data.username.strip()

    if data.amount <= 0:

        raise HTTPException(
            status_code=400,
            detail="Сумма должна быть больше 0"
        )

    user = db.query(User).filter(
        User.username == username
    ).first()

    if not user:

        raise HTTPException(
            status_code=404,
            detail="Пользователь с таким ником не найден"
        )

    old_balance = user.balance

    user.balance = round(
        user.balance + data.amount,
        2
    )

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": "Деньги успешно выданы",
        "username": user.username,
        "old_balance": old_balance,
        "amount": data.amount,
        "new_balance": user.balance,
        "reason": data.reason
    }


# =====================================================
# ADMIN — SET BALANCE BY USERNAME
# =====================================================

@app.put("/api/admin/users/balance")
def set_balance(
    data: BalanceRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):

    if data.amount < 0:

        raise HTTPException(
            status_code=400,
            detail="Баланс не может быть отрицательным"
        )

    user = db.query(User).filter(
        User.username == data.username.strip()
    ).first()

    if not user:

        raise HTTPException(
            status_code=404,
            detail="Пользователь не найден"
        )

    user.balance = round(
        data.amount,
        2
    )

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": "Баланс установлен",
        "username": user.username,
        "balance": user.balance
    }


# =====================================================
# ADMIN — PROMO CODES
# =====================================================

@app.get("/api/admin/promocodes")
def get_promocodes(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):

    promos = db.query(
        PromoCode
    ).order_by(
        PromoCode.id.desc()
    ).all()

    return {
        "success": True,
        "promocodes": [
            {
                "id": promo.id,
                "code": promo.code,
                "bonus": promo.bonus,
                "max_uses": promo.max_uses,
                "uses": promo.uses,
                "active": promo.active,
                "created_at": promo.created_at
            }
            for promo in promos
        ]
    }


@app.post("/api/admin/promocodes")
def create_promocode(
    data: PromoCreateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):

    code = data.code.strip().upper()

    if not code:

        raise HTTPException(
            status_code=400,
            detail="Введите промокод"
        )

    if data.bonus <= 0:

        raise HTTPException(
            status_code=400,
            detail="Бонус должен быть больше 0"
        )

    if data.max_uses <= 0:

        raise HTTPException(
            status_code=400,
            detail="Количество использований должно быть больше 0"
        )

    existing = db.query(
        PromoCode
    ).filter(
        PromoCode.code == code
    ).first()

    if existing:

        raise HTTPException(
            status_code=400,
            detail="Такой промокод уже существует"
        )

    promo = PromoCode(
        code=code,
        bonus=data.bonus,
        max_uses=data.max_uses,
        uses=0,
        active=True
    )

    db.add(promo)
    db.commit()
    db.refresh(promo)

    return {
        "success": True,
        "message": "Промокод создан",
        "promo": {
            "id": promo.id,
            "code": promo.code,
            "bonus": promo.bonus,
            "max_uses": promo.max_uses,
            "uses": promo.uses,
            "active": promo.active
        }
    }


# =====================================================
# ADMIN — DELETE PROMO
# =====================================================

@app.delete("/api/admin/promocodes/{promo_id}")
def delete_promocode(
    promo_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):

    promo = db.query(
        PromoCode
    ).filter(
        PromoCode.id == promo_id
    ).first()

    if not promo:

        raise HTTPException(
            status_code=404,
            detail="Промокод не найден"
        )

    db.delete(promo)
    db.commit()

    return {
        "success": True,
        "message": "Промокод удалён"
    }


# =====================================================
# USER — ACTIVATE PROMO
# =====================================================

@app.post("/api/promocode/activate")
def activate_promocode(
    data: PromoActivateRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db)
):

    code = data.code.strip().upper()

    promo = db.query(
        PromoCode
    ).filter(
        PromoCode.code == code
    ).first()

    if not promo:

        raise HTTPException(
            status_code=404,
            detail="Промокод не найден"
        )

    if not promo.active:

        raise HTTPException(
            status_code=400,
            detail="Промокод отключён"
        )

    if promo.uses >= promo.max_uses:

        raise HTTPException(
            status_code=400,
            detail="Лимит использований промокода исчерпан"
        )

    already_used = db.query(
        PromoUse
    ).filter(
        PromoUse.promo_id == promo.id,
        PromoUse.user_id == user.id
    ).first()

    if already_used:

        raise HTTPException(
            status_code=400,
            detail="Вы уже использовали этот промокод"
        )

    user.balance = round(
        user.balance + promo.bonus,
        2
    )

    promo.uses += 1

    if promo.uses >= promo.max_uses:

        promo.active = False

    promo_use = PromoUse(
        promo_id=promo.id,
        user_id=user.id
    )

    db.add(promo_use)

    db.commit()

    return {
        "success": True,
        "message": "Промокод успешно активирован",
        "bonus": promo.bonus,
        "balance": user.balance
    }


# =====================================================
# ADMIN — STATS
# =====================================================

@app.get("/api/admin/stats")
def admin_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):

    users_count = db.query(
        User
    ).count()

    promos_count = db.query(
        PromoCode
    ).count()

    admins_count = db.query(
        User
    ).filter(
        User.is_admin == True
    ).count()

    return {
        "success": True,
        "users": users_count,
        "promos": promos_count,
        "admins": admins_count,
        "servers": 0,
        "online": 1
    }
