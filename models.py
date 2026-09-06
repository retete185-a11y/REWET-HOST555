from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, ForeignKey
from datetime import datetime

from database import Base


class User(Base):

    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    username = Column(
        String(24),
        unique=True,
        nullable=False,
        index=True
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    balance = Column(
        Float,
        default=0.0,
        nullable=False
    )

    is_admin = Column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


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
