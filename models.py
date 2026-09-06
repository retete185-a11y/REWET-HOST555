from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Float,
    Boolean,
    ForeignKey
)

from database import Base


# =====================================================
# ПОЛЬЗОВАТЕЛИ
# =====================================================

class User(Base):

    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Имя клиента
    first_name = Column(
        String(50),
        nullable=False,
        default=""
    )

    # Фамилия клиента
    last_name = Column(
        String(50),
        nullable=False,
        default=""
    )

    # Никнейм
    username = Column(
        String(24),
        unique=True,
        nullable=False,
        index=True
    )

    # E-Mail
    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    # Хэш пароля
    password_hash = Column(
        String(255),
        nullable=False
    )

    # Баланс
    balance = Column(
        Float,
        default=0.0,
        nullable=False
    )

    # Администратор
    is_admin = Column(
        Boolean,
        default=False,
        nullable=False
    )

    # Дата регистрации
    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# =====================================================
# ПРОМОКОДЫ
# =====================================================

class PromoCode(Base):

    __tablename__ = "promo_codes"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    code = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    bonus = Column(
        Float,
        nullable=False
    )

    max_uses = Column(
        Integer,
        default=1,
        nullable=False
    )

    uses = Column(
        Integer,
        default=0,
        nullable=False
    )

    active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# =====================================================
# ИСПОЛЬЗОВАНИЕ ПРОМОКОДОВ
# =====================================================

class PromoUse(Base):

    __tablename__ = "promo_uses"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    promo_id = Column(
        Integer,
        ForeignKey("promo_codes.id"),
        nullable=False
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )
