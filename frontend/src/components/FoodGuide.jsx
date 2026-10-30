import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, RotateCcw, Sparkles, Square, X } from "lucide-react";

import { streamFoodGuide } from "../api/client";

const SUGGESTIONS = [
  "What food is Hyderabad famous for?",
  "Famous street food in Mumbai",
  "Must-try dishes in Kolkata",
  "What should I eat in Kerala?",
];

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part,
  );
}

function RichText({ text }) {
  const blocks = [];
  for (const line of text.split("\n")) {
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) {
      const last = blocks.at(-1);
      if (last?.type === "list") last.items.push(bullet[1]);
      else blocks.push({ type: "list", items: [bullet[1]] });
    } else if (line.trim()) {
      blocks.push({ type: "p", text: line.replace(/^#+\s*/, "") });
    }
  }
  return blocks.map((block, index) =>
    block.type === "list" ? (
      <ul key={index}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item)}</li>
        ))}
      </ul>
    ) : (
      <p key={index}>{renderInline(block.text)}</p>
    ),
  );
}

export function FoodGuide({ token }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("");
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, error]);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function updateLastReply(update) {
    setMessages((current) => {
      const next = current.slice();
      const last = next.at(-1);
      next[next.length - 1] = { ...last, content: update(last.content) };
      return next;
    });
  }

  async function send(text) {
    const question = text.trim();
    if (!question || streaming) return;
    const history = [...messages.filter((message) => message.content), { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError("");
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamFoodGuide({
        token,
        messages: history,
        signal: controller.signal,
        onText: (chunk) => updateLastReply((content) => content + chunk),
        onReplace: (replacement) => updateLastReply(() => replacement),
        onMode: setMode,
      });
    } catch (streamError) {
      if (streamError.name !== "AbortError") setError(streamError.message);
      setMessages((current) => (current.at(-1)?.content ? current : current.slice(0, -1)));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setError("");
  }

  return (
    <>
      <button
        className={`guide-fab ${open ? "guide-fab--hidden" : ""}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Food Guide"
      >
        <Sparkles size={20} />
        <span>Food Guide</span>
      </button>

      {open ? (
        <section className="guide" role="dialog" aria-label="Food Guide">
          <header className="guide__header">
            <span className="guide__avatar">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>Food Guide</strong>
              <small>
                {mode === "builtin"
                  ? "Quick guide · 30+ popular places"
                  : "Ask what any place is famous for"}
              </small>
            </div>
            {messages.length > 0 ? (
              <button className="guide__icon" type="button" onClick={reset} title="New chat" aria-label="New chat">
                <RotateCcw size={16} />
              </button>
            ) : null}
            <button className="guide__icon" type="button" onClick={() => setOpen(false)} aria-label="Close">
              <X size={18} />
            </button>
          </header>

          <div className="guide__body" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="guide__welcome">
                <span className="guide__welcome-icon">
                  <MessageCircle size={22} />
                </span>
                <h3>Hungry for something local?</h3>
                <p>Name a city, state or country and I'll tell you its famous dishes — and what you can order here.</p>
                <div className="guide__chips">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => send(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={`bubble bubble--${message.role}`}>
                  {message.role === "assistant" ? (
                    message.content ? (
                      <RichText text={message.content} />
                    ) : (
                      <span className="typing" aria-label="Thinking">
                        <i />
                        <i />
                        <i />
                      </span>
                    )
                  ) : (
                    <Fragment>{message.content}</Fragment>
                  )}
                </div>
              ))
            )}
            {error ? <div className="guide__error">{error}</div> : null}
          </div>

          <form
            className="guide__composer"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="e.g. What is Lucknow famous for?"
              aria-label="Ask the Food Guide"
            />
            {streaming ? (
              <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop">
                <Square size={14} />
              </button>
            ) : (
              <button type="submit" disabled={!draft.trim()} aria-label="Send">
                <ArrowUp size={18} />
              </button>
            )}
          </form>
        </section>
      ) : null}
    </>
  );
}
