
from sqlalchemy import String, Boolean, Integer, Column, DateTime, ForeignKey, Text, CheckConstraint, BigInteger, Date, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, relationship
from typing import Optional, List
from backend.db.database import Base
from datetime import datetime






class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    email: Mapped[str] = Column(String(100), unique=True, nullable=False, index=True)
    phone: Mapped[Optional[str]]= Column(String(25), nullable=True, index=True)
    hashed_password: Mapped[str] = Column(String(128), nullable=False)
    name: Mapped[str] = Column(String(100), nullable=False, index=True)
    surname: Mapped[str] = Column(String(100), nullable=False, index=True)
    fathername: Mapped[Optional[str]] = Column(String(100), nullable=False, index=True)
    birthday: Mapped[Date] = Column(Date, nullable=False, index=True)
    gender: Mapped[Optional[str]] = Column(String(6), nullable=False, index=True)
    group: Mapped[Optional[str]] = Column(String(15), nullable=False, index=True)
    is_active: Mapped[bool] = Column(Boolean, nullable=False, default=True, index=True)
    is_verified: Mapped[bool] = Column(Boolean, nullable=False, default=False)
    role: Mapped[str] = Column(String(10), default='buyer', index=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True), onupdate=func.now())

    products: Mapped[Optional[List["Product"]]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chat_messages: Mapped[Optional[List["GlobalChatMessage"]]] = relationship(
        back_populates="user",
        order_by="ChatMessage.created_at",
        cascade="all, delete-orphan"
    )



class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = Column(Integer, ForeignKey("users.id", ondelete='CASCADE'),
                                                index=True)
    name: Mapped[str] = Column(String(200), index=True, nullable=False)
    description: Mapped[Optional[str]] = Column(Text, nullable=True)
    price: Mapped[int] = Column(BigInteger, nullable=False, index=True)
    vat: Mapped[Optional[int]] = Column(Integer, nullable=True)
    is_vat_included: Mapped[bool] = Column(Boolean, nullable=False, default=True)
    quantity: Mapped[int] = Column(Integer, CheckConstraint('quantity >= 0'), default=0.0, nullable=False, index=True)
    category: Mapped[Optional[str]] = Column(String(128), nullable=True, index=True)
    weight: Mapped[Optional[str]] = Column(String, nullable=True)
    dimensions: Mapped[Optional[str]] = Column(String(100), nullable=True)
    is_active: Mapped[bool] = Column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True), onupdate=func.now())
    rating: Mapped[float] = Column(Float, default=0.0, index=True)

    user: Mapped[User] = relationship("User", backref="products")



# class GlobalChat(Base):
#     __tablename__ = 'global_chats'
#
#     id: Mapped[int] = Column(Integer, primary_key=True, index=True)
#     title: Mapped[str] = Column(String(100), default="Общий чат", index=True)
#     created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now())
#     is_active: Mapped[bool] = Column(Boolean, default=True)


class GlobalChatMessage(Base):
    __tablename__ = 'global_chat_messages'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = Column(Integer, ForeignKey("users.id", ondelete='CASCADE'))
    message_type: Mapped[str] = Column(String(20), nullable=False)
    content: Mapped[str] = Column(Text, nullable=False)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now())
    is_read: Mapped[bool] = Column(Boolean, default=False)

    user: Mapped["User"] = relationship("User", backref="global_chat_messages")

class SupportChat(Base):
    __tablename__ = 'support_chats'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = Column(Integer, ForeignKey("users.id", ondelete='CASCADE'), index=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), onupdate=func.now())
    last_message_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    is_active: Mapped[bool] = Column(Boolean, default=True)

    user: Mapped["User"] = relationship("User", backref="support_chats")
    messages: Mapped[List["SupportMessage"]] = relationship(
        "SupportMessage",
        back_populates="chat",
        order_by="SupportMessage.created_at",
        cascade="all, delete-orphan"
    )



class SupportMessage(Base):
    __tablename__ = 'support_messages'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    chat_id: Mapped[int] = Column(Integer, ForeignKey("support_chats.id", ondelete='CASCADE'), index=True)
    sender_id: Mapped[int] = Column(Integer, ForeignKey("users.id", ondelete='CASCADE'), index=True)
    message_type: Mapped[str] = Column(String(20), nullable=False)
    content: Mapped[str] = Column(Text, nullable=False)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now())
    is_read: Mapped[bool] = Column(Boolean, default=False)

    chat: Mapped["SupportChat"] = relationship("SupportChat", back_populates="messages")
    sender: Mapped["User"] = relationship("User")

class Schedule(Base):
    __tablename__ = 'schedules'
    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    # date: Mapped[date] = Column(Date, nullable=False, index=True)
    subject: Mapped[str] = Column(String(50), nullable=False, index=True)
    group: Mapped[str] = Column(String(15), nullable=False, index=True)
    start: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False)
    end: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False)
    teacher: Mapped[str] = Column(String(100), nullable=False, index=True)
    link: Mapped[str] = Column(String(100), nullable=True, index=True)
    auditory: Mapped[str] = Column(String(100), nullable=False, index=True)
    status: Mapped[str] = Column(String(20), nullable=False, default="active", index=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), onupdate=func.now())


class Event(Base):
    __tablename__ = 'events'
    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    title: Mapped[str] = Column(String(100), nullable=False, index=True)
    made_by_user_id: Mapped[int] = Column(Integer, ForeignKey("users.id"), index=True)
    event_type: Mapped[str] = Column(String(20), nullable=False, index=True)
    description: Mapped[str] = Column(Text, nullable=False)
    start_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, index=True)
    end_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True), index=True)
    is_published: Mapped[bool] = Column(Boolean, default=False, index=True)
    status: Mapped[str] = Column(String(20), default="draft", index=True)  # "draft", "published", "cancelled"
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now())

class PromoCode(Base):
    __tablename__ = 'promo_codes'

    id: Mapped[int] = Column(Integer, primary_key=True)
    code: Mapped[str] = Column(String(50), unique=True, index=True)
    discount_percent: Mapped[float] = Column(Float, nullable=False)
    is_active: Mapped[bool] = Column(Boolean, default=True)
    usage_limit: Mapped[Optional[int]] = Column(Integer)
    used_count: Mapped[int] = Column(Integer, default=0)
    valid_from: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now())