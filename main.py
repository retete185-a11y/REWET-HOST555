import os
import secrets
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from passlib.context import CryptContext

from database import Base, engine, get_db
from models import User, PromoCode, PromoUse


# =====================================================
# НАСТРОЙКИ
# =====================================================

API_TITLE = "REWET HOST API"

OWNER_ADMIN_ID = int(
    os.getenv("ADMIN_USER_ID", "421573")
)

SESSION_DAYS = 30


# =====================================================
# FASTAPI
# =====================================================

app = FastAPI(
    title=API_TITLE,
    version="2.0.0"
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

            # -----------------------------------------
            # FIRST NAME
            # -----------------------------------------

            if "first_name" not in columns:

                conn.execute(
                    text("""
                        ALTER TABLE users
                        ADD COLUMN first_name VARCHAR(50)
                        NOT NULL DEFAULT ''
                    """)
                )

            # -----------------------------------------
            # LAST NAME
            # -----------------------------------------

            if "last_name" not in columns:

                conn.execute(
                    text("""
                        ALTER TABLE users
                        ADD COLUMN last_name VARCHAR(50)
                        NOT NULL DEFAULT ''
                    """)
                )

            # -----------------------------------------
            # BALANCE
            # -----------------------------------------

            if "balance" not in columns:

                conn.execute(
                    text("""
                        ALTER TABLE users
                        ADD COLUMN balance FLOAT
                        NOT NULL DEFAULT 0
                    """)
                )

            # -----------------------------------------
            # IS ADMIN
            # -----------------------------------------

            if "is_admin" not in columns:

                conn.execute(
                    text("""
                        ALTER TABLE users
                        ADD COLUMN is_admin BOOLEAN
                        NOT NULL DEFAULT FALSE
                    """)
                )

            print("Database migration completed")

    except Exception as e:

        print(
            "DB migration warning:",
            e
        )


ensure_user_columns()


# =====================================================
# PYDANTIC MODELS
# =====================================================

class RegisterRequest(BaseModel):

    first_name: str
    last_name: str
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

def normalize_name(value: str):

    return " ".join(
        value.strip().split()
    )


def normalize_username(username: str):

    return username.strip()


def normalize_email(email: str):

    return email.strip().lower()


def validate_name(name: str, field_name: str):

    name = normalize_name(name)

    if len(name) < 2:

        raise HTTPException(
            status_code=400,
            detail=f"{field_name} должен содержать минимум 2 символа"
        )

    if len(name) > 50:

        raise HTTPException(
            status_code=400,
            detail=f"{field_name} слишком длинный"
        )

    return name


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


# =====================================================
# USER RESPONSE
# =====================================================

def user_data(user: User):

    return {
        "id": user.id,

        "first_name": user.first_name,

        "last_name": user.last_name,

        "username": user.username,

        "email": user.email,

        "balance": float(
            user.balance or 0
        ),

        "is_admin": bool(
            user.is_admin
        ),

        "created_at": user.created_at
    }


# =====================================================
# SESSION
# =====================================================

def create_session(
    response: Response,
    user_id: int
):

    token = secrets.token_urlsafe(48)

    max_age = (
        SESSION_DAYS *
        24 *
        60 *
        60
    )

    response.set_cookie(
        key="rewet_session",
        value=token,
        max_age=max_age,
        httponly=True,
        secure=True,
        samesite="none",
        path="/"
    )

    response.set_cookie(
        key="rewet_user_id",
        value=str(user_id),
        max_age=max_age,
        httponly=True,
        secure=True,
        samesite="none",
        path="/"
    )


# =====================================================
# CURRENT USER
# =====================================================

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

    except (ValueError, TypeError):

        return None

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:

        return None

    # Владелец REWET HOST всегда администратор
    if user.id == OWNER_ADMIN_ID:

        if not user.is_admin:

            user.is_admin = True

            db.commit()

            db.refresh(user)

    return user


# =====================================================
# REQUIRE USER
# =====================================================

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


# =====================================================
# REQUIRE ADMIN
# =====================================================

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

    # Владелец
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
        "version": "2.0.0"
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
        "status": "online",
        "version": "2.0.0"
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

    # -----------------------------------------
    # ИМЯ
    # -----------------------------------------

    first_name = validate_name(
        data.first_name,
        "Имя"
    )

    # -----------------------------------------
    # ФАМИЛИЯ
    # -----------------------------------------

    last_name = validate_name(
        data.last_name,
        "Фамилия"
    )

    # -----------------------------------------
    # НИК
    # -----------------------------------------

    username = normalize_username(
        data.username
    )

    validate_username(
        username
    )

    # -----------------------------------------
    # EMAIL
    # -----------------------------------------

    email = normalize_email(
        data.email
    )

    validate_email(
        email
    )

    # -----------------------------------------
    # PASSWORD
    # -----------------------------------------

    validate_password(
        data.password
    )

    # -----------------------------------------
    # ПРОВЕРКА НИКА
    # -----------------------------------------

    existing_username = db.query(
        User
    ).filter(
        User.username == username
    ).first()

    if existing_username:

        raise HTTPException(
            status_code=400,
            detail="Этот ник уже занят"
        )

    # -----------------------------------------
    # ПРОВЕРКА EMAIL
    # -----------------------------------------

    existing_email = db.query(
        User
    ).filter(
        User.email == email
    ).first()

    if existing_email:

        raise HTTPException(
            status_code=400,
            detail="Этот E-Mail уже зарегистрирован"
        )

    # -----------------------------------------
    # СОЗДАНИЕ
    # -----------------------------------------

    user = User(

        first_name=first_name,

        last_name=last_name,

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

    # -----------------------------------------
    # ВЛАДЕЛЕЦ
    # -----------------------------------------

    if user.id == OWNER_ADMIN_ID:

        user.is_admin = True

        db.commit()

        db.refresh(user)

    # -----------------------------------------
    # SESSION
    # -----------------------------------------

    create_session(
        response,
        user.id
    )

    return {
        "success": True,
        "message": "Аккаунт успешно создан",
        "user": user_data(user)
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

    user = db.query(
        User
    ).filter(
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

    # -----------------------------------------
    # ВЛАДЕЛЕЦ
    # -----------------------------------------

    if user.id == OWNER_ADMIN_ID:

        user.is_admin = True

        db.commit()

        db.refresh(user)

    # -----------------------------------------
    # SESSION
    # -----------------------------------------

    create_session(
        response,
        user.id
    )

    return {
        "success": True,
        "message": "Авторизация успешна",
        "user": user_data(user)
    }


# =====================================================
# LOGOUT
# =====================================================

@app.post("/api/logout")
def logout(
    response: Response
):

    response.delete_cookie(
        "rewet_session",
        path="/"
    )

    response.delete_cookie(
        "rewet_user_id",
        path="/"
    )

    return {
        "success": True,
        "message": "Вы вышли из аккаунта"
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
        "user": user_data(user)
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
        "user": user_data(user)
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

    user = db.query(
        User
    ).filter(
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

    user = db.query(
        User
    ).filter(
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

    users = db.query(
        User
    ).order_by(
        User.id.desc()
    ).all()

    return {
        "success": True,

        "users": [
            user_data(user)
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

    user = db.query(
        User
    ).filter(
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

        "message": (
            f"Пользователь {user.username} "
            f"теперь администратор"
        ),

        "user": user_data(user)
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

    user = db.query(
        User
    ).filter(
        User.username == username.strip()
    ).first()

    if not user:

        raise HTTPException(
            status_code=404,
            detail="Пользователь не найден"
        )

    # Нельзя снять админку владельца
    if user.id == OWNER_ADMIN_ID:

        raise HTTPException(
            status_code=400,
            detail="Нельзя снять права владельца REWET HOST"
        )

    user.is_admin = False

    db.commit()

    return {
        "success": True,
        "message": (
            f"Админка снята с {user.username}"
        )
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

    user = db.query(
        User
    ).filter(
        User.username == username
    ).first()

    if not user:

        raise HTTPException(
            status_code=404,
            detail="Пользователь с таким ником не найден"
        )

    old_balance = float(
        user.balance or 0
    )

    user.balance = round(
        old_balance + data.amount,
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

        "new_balance": float(
            user.balance
        ),

        "reason": data.reason
    }


# =====================================================
# ADMIN — SET BALANCE
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

    user = db.query(
        User
    ).filter(
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

        "balance": float(
            user.balance
        )
    }


# =====================================================
# ADMIN — PROMOCODES
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


# =====================================================
# ADMIN — CREATE PROMOCODE
# =====================================================

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
            detail=(
                "Количество использований "
                "должно быть больше 0"
            )
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

    # Удаляем связанные использования
    db.query(
        PromoUse
    ).filter(
        PromoUse.promo_id == promo.id
    ).delete(
        synchronize_session=False
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

    if not code:

        raise HTTPException(
            status_code=400,
            detail="Введите промокод"
        )

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
            detail=(
                "Лимит использований "
                "промокода исчерпан"
            )
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
        float(user.balance or 0) + promo.bonus,
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

    db.refresh(user)

    return {
        "success": True,

        "message": "Промокод успешно активирован",

        "bonus": promo.bonus,

        "balance": float(
            user.balance
        )
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

        # Пока временно.
        # Реальный online сделаем следующим шагом.
        "online": 1
                    }
