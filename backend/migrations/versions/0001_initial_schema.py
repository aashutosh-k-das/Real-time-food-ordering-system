"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-07-08 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute("CREATE TYPE user_role AS ENUM ('customer', 'restaurant', 'delivery_partner')")
    op.execute(
        "CREATE TYPE order_status AS ENUM ('placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')"
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("role", sa.Enum("customer", "restaurant", "delivery_partner", name="user_role"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "restaurants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_restaurants_name", "restaurants", ["name"])

    op.create_table(
        "menu_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.CHAR(length=3), nullable=False),
        sa.Column("available_inventory", sa.Integer(), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_menu_items_restaurant_id", "menu_items", ["restaurant_id"])

    op.create_table(
        "delivery_partners",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("vehicle_type", sa.String(length=40), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("current_latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("current_longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("idx_delivery_partners_available", "delivery_partners", ["is_available"])

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("delivery_partner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("delivery_partners.id"), nullable=True),
        sa.Column("status", sa.Enum("placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled", name="order_status"), nullable=False),
        sa.Column("delivery_address", sa.Text(), nullable=False),
        sa.Column("delivery_latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("delivery_longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("subtotal_minor", sa.Integer(), nullable=False),
        sa.Column("delivery_fee_minor", sa.Integer(), nullable=False),
        sa.Column("total_minor", sa.Integer(), nullable=False),
        sa.Column("placed_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("prepared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("out_for_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_orders_customer_id", "orders", ["customer_id"])
    op.create_index("idx_orders_restaurant_id", "orders", ["restaurant_id"])
    op.create_index("idx_orders_status", "orders", ["status"])

    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("menu_item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("menu_items.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price_minor", sa.Integer(), nullable=False),
        sa.Column("line_total_minor", sa.Integer(), nullable=False),
        sa.Column("menu_item_name", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_order_items_order_id", "order_items", ["order_id"])

    op.create_table(
        "order_status_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Enum("placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled", name="order_status"), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_order_status_events_order_id", "order_status_events", ["order_id"])


def downgrade() -> None:
    op.drop_index("idx_order_status_events_order_id", table_name="order_status_events")
    op.drop_table("order_status_events")
    op.drop_index("idx_order_items_order_id", table_name="order_items")
    op.drop_table("order_items")
    op.drop_index("idx_orders_status", table_name="orders")
    op.drop_index("idx_orders_restaurant_id", table_name="orders")
    op.drop_index("idx_orders_customer_id", table_name="orders")
    op.drop_table("orders")
    op.drop_index("idx_delivery_partners_available", table_name="delivery_partners")
    op.drop_table("delivery_partners")
    op.drop_index("idx_menu_items_restaurant_id", table_name="menu_items")
    op.drop_table("menu_items")
    op.drop_index("idx_restaurants_name", table_name="restaurants")
    op.drop_table("restaurants")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS order_status")
    op.execute("DROP TYPE IF EXISTS user_role")
