import asyncio
import os
from pathlib import Path

import asyncpg


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_SQL = ROOT / "schema.sql"
SEED_SQL = ROOT / "seed.sql"


def normalize_dsn(dsn: str) -> str:
    return dsn.replace("postgresql+asyncpg://", "postgresql://", 1)


def split_sql(sql: str) -> list[str]:
    return [statement.strip() for statement in sql.split(";") if statement.strip()]


async def wait_for_database(dsn: str, attempts: int = 30, delay_seconds: float = 2.0) -> None:
    for attempt in range(1, attempts + 1):
        try:
            conn = await asyncpg.connect(dsn)
            await conn.close()
            return
        except Exception as exc:
            if attempt == attempts:
                raise RuntimeError("Database did not become ready in time") from exc
            await asyncio.sleep(delay_seconds)


async def initialize_schema(conn: asyncpg.Connection) -> None:
    users_table_exists = await conn.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')"
    )
    if users_table_exists:
        return
    for statement in split_sql(SCHEMA_SQL.read_text()):
        await conn.execute(statement)


async def seed_data(conn: asyncpg.Connection) -> None:
    for statement in split_sql(SEED_SQL.read_text()):
        await conn.execute(statement)


async def main() -> None:
    dsn = normalize_dsn(
        os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/food_ordering")
    )
    await wait_for_database(dsn)
    conn = await asyncpg.connect(dsn)
    try:
        async with conn.transaction():
            await conn.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
        await initialize_schema(conn)
        await seed_data(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
