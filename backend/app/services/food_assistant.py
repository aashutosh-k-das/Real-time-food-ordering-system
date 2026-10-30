import asyncio
import json
from collections.abc import AsyncIterator

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models import Restaurant
from app.schemas.assistant import AssistantChatMessage
from app.services.food_knowledge import answer_from_guide, find_place


SYSTEM_PROMPT = """You are the Food Guide inside Dispatch, a food ordering and delivery app in India.

Your main job: when someone names a place (a city, state, region or country), tell them which foods it is famous for. For each dish give its name, one line on what it is, and where relevant whether it is vegetarian. Prefer 4-6 dishes, lead with the most iconic one, and mention a famous local spot or street-food habit when you know one. If a place is ambiguous, pick the most likely one and say which you assumed.

You can also help people choose what to eat, explain dishes, and suggest pairings. When a dish (or something close to it) is on the menu below, point it out by its exact menu name and price so they can order it. Never invent menu items, prices or stock — only what is listed. Our menu is not the whole cuisine, so when nothing matches, say so plainly.

You cannot place orders, change orders or see order status; tell people to use the app for that.

Keep answers short and scannable: a one-line intro, then a bulleted list. Use **bold** for dish names. No headings, no tables."""


async def load_menu(session: AsyncSession) -> list[Restaurant]:
    return list(
        (
            await session.execute(
                select(Restaurant).where(Restaurant.is_active.is_(True)).options(selectinload(Restaurant.menu_items))
            )
        ).scalars().all()
    )


def build_menu_context(restaurants: list[Restaurant]) -> str:
    lines: list[str] = []
    for restaurant in restaurants:
        lines.append(f"{restaurant.name} — {restaurant.description or 'no description'}")
        for item in restaurant.menu_items:
            if not item.is_available:
                continue
            stock = "sold out" if item.available_inventory <= 0 else f"{item.available_inventory} left"
            lines.append(
                f"  - {item.name}: {item.price_minor / 100:.2f} {item.currency} ({stock}). {item.description or ''}".rstrip()
            )
    return "\n".join(lines) if lines else "No restaurants are open right now."


def menu_item_labels(restaurants: list[Restaurant]) -> list[tuple[str, str]]:
    return [
        (item.name, f"₹{item.price_minor / 100:.2f}")
        for restaurant in restaurants
        for item in restaurant.menu_items
        if item.is_available and item.available_inventory > 0
    ]


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _guide_question(messages: list[AssistantChatMessage]) -> str:
    # Follow-ups like "which of those are veg?" refer to the last place mentioned.
    user_turns = [message.content for message in messages if message.role == "user"]
    for text in reversed(user_turns):
        if find_place(text):
            return text
    return user_turns[-1]


async def _stream_guide_answer(messages: list[AssistantChatMessage], restaurants: list[Restaurant]) -> AsyncIterator[str]:
    yield _sse({"type": "mode", "mode": "builtin"})
    answer = answer_from_guide(_guide_question(messages), menu_item_labels(restaurants))
    for start in range(0, len(answer), 24):
        yield _sse({"type": "text", "text": answer[start : start + 24]})
        await asyncio.sleep(0.015)
    yield _sse({"type": "done"})


async def _stream_claude_answer(
    messages: list[AssistantChatMessage],
    restaurants: list[Restaurant],
    api_key: str,
) -> AsyncIterator[str]:
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=api_key)
    sent_text = False
    try:
        async with client.beta.messages.stream(
            model=settings.assistant_model,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low"},
            system=[
                {"type": "text", "text": SYSTEM_PROMPT},
                {"type": "text", "text": f"Current menu:\n{build_menu_context(restaurants)}"},
            ],
            messages=[message.model_dump() for message in messages],
        ) as stream:
            yield _sse({"type": "mode", "mode": "ai"})
            async for text in stream.text_stream:
                sent_text = True
                yield _sse({"type": "text", "text": text})
            final = await stream.get_final_message()
        if final.stop_reason == "refusal":
            yield _sse({"type": "replace", "text": "Sorry, I can't help with that one. Ask me about food from any place!"})
        yield _sse({"type": "done"})
    except (anthropic.APIStatusError, anthropic.APIConnectionError):
        if sent_text:
            yield _sse({"type": "error", "message": "The Food Guide was interrupted. Please try again."})
            return
        # The AI service is unreachable or rejected the request — answer from the built-in guide instead.
        async for event in _stream_guide_answer(messages, restaurants):
            yield event


async def stream_food_assistant(
    session: AsyncSession,
    messages: list[AssistantChatMessage],
) -> AsyncIterator[str]:
    restaurants = await load_menu(session)
    api_key = get_settings().anthropic_api_key
    if not api_key:
        return _stream_guide_answer(messages, restaurants)
    return _stream_claude_answer(messages, restaurants, api_key)
