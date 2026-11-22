import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  AlertCircle,
  ArrowDown,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  FileText,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react";

import type { ChatMessage } from "../types";

const starterQuestions = [
  "Summarize the key ideas across my documents.",
  "What decisions or action items are mentioned?",
  "Find important dates, figures, or requirements.",
  "Compare the main points in my uploaded files.",
];

function renderInline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, index) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code
        key={index}
        className="rounded-md border border-white/[0.08] bg-black/25 px-1.5 py-0.5 font-mono text-[0.92em] text-cyan-100"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[#090e17]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] text-slate-500">{language || "code"}</span>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100"
          aria-label="Copy code block"
        >
          {copyStatus === "copied" ? <Check size={12} /> : <Clipboard size={12} />}
          {copyStatus === "copied"
            ? "Copied"
            : copyStatus === "failed"
              ? "Copy failed"
              : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-5 text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function AssistantContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: Array<
    | { type: "paragraph"; text: string }
    | { type: "list"; items: string[] }
    | { type: "code"; code: string; language: string }
  > = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```([\w+-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({
        type: "code",
        code: codeLines.join("\n"),
        language: fence[1],
      });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*```/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return (
    <div className="assistant-content text-[13px] leading-6">
      {blocks.map((block, blockIndex) => {
        if (block.type === "code") {
          return (
            <CodeBlock
              key={blockIndex}
              code={block.code}
              language={block.language}
            />
          );
        }
        if (block.type === "list") {
          return (
            <ul
              key={blockIndex}
              className="my-2 list-disc space-y-1 pl-5 marker:text-cyan-400"
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={blockIndex} className="my-2 first:mt-0 last:mb-0">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function CopyResponse({ content }: { content: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  };

  return (
    <button
      type="button"
      onClick={() => void copyResponse()}
      aria-label={
        copyStatus === "copied"
          ? "Response copied"
          : copyStatus === "failed"
            ? "Copy failed"
            : "Copy response"
      }
      className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300"
    >
      {copyStatus === "copied" ? <Check size={11} /> : <Clipboard size={11} />}
      {copyStatus === "copied"
        ? "Copied"
        : copyStatus === "failed"
          ? "Copy failed"
          : "Copy"}
    </button>
  );
}

function Sources({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);
  if (!message.sources?.length) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.07] bg-[#0b111c]/70">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
          <FileText size={13} className="text-cyan-300" />
          Sources <span className="text-slate-500">{message.sources.length}</span>
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-500" />
        ) : (
          <ChevronDown size={14} className="text-slate-500" />
        )}
      </button>
      {expanded && (
        <ul className="space-y-2 border-t border-white/[0.06] px-3.5 py-3">
          {message.sources.map((source) => (
            <li
              key={source.document_id}
              className="rounded-lg border border-white/[0.05] bg-[#111827]/75 p-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <FileText size={14} className="mt-0.5 shrink-0 text-blue-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-200">
                    {source.filename}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {source.chunk_indices.length} cited{" "}
                    {source.chunk_indices.length === 1 ? "chunk" : "chunks"}
                    {source.chunks?.some((chunk) => chunk.page_number != null) &&
                      ` · Pages ${[
                        ...new Set(
                          source.chunks
                            .map((chunk) => chunk.page_number)
                            .filter((page): page is number => page != null),
                        ),
                      ].join(", ")}`}
                  </p>
                </div>
              </div>
              {source.chunks?.length ? (
                <div className="mt-3 space-y-2">
                  {source.chunks.map((chunk) => (
                    <div
                      key={chunk.chunk_index}
                      className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#0b0f17]/80"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.05] px-2.5 py-2 text-[10px] text-slate-500">
                        <span>Chunk {chunk.chunk_index + 1}</span>
                        {chunk.page_number != null && (
                          <span>Page {chunk.page_number}</span>
                        )}
                        {typeof chunk.score === "number" && (
                          <span className="ml-auto text-cyan-200/80">
                            Similarity {chunk.score.toFixed(3)}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap break-words px-2.5 py-2.5 font-mono text-[11px] leading-5 text-slate-400">
                        {chunk.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-slate-600">
                  Cited chunk indices: {source.chunk_indices.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ChatPanelProps {
  title: string;
  messages: ChatMessage[];
  sending: boolean;
  onPrompt: (prompt: string) => void;
  onRetry: (message: ChatMessage) => void;
  onOpenDocuments: () => void;
}

export default function ChatPanel({
  title,
  messages,
  sending,
  onPrompt,
  onRetry,
  onOpenDocuments,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const handleScroll = (event: UIEvent<HTMLElement>) => {
    const element = event.currentTarget;
    setShowScrollButton(
      element.scrollHeight - element.scrollTop - element.clientHeight > 240,
    );
  };

  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth"
      onScroll={handleScroll}
      aria-label="Conversation"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-1 flex-col items-center justify-center px-4 py-8 text-center sm:px-6">
          <div className="w-full rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#111b2b]/80 to-[#0d1420]/80 px-5 py-8 shadow-[0_18px_70px_rgba(0,0,0,0.16)] sm:px-10 sm:py-10">
            <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-blue-500/15 to-cyan-400/10 text-cyan-200 shadow-[0_0_35px_rgba(37,99,235,0.12)]">
              <Sparkles size={23} />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-300">
              RAG Document Chunking Pipeline
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
              {title === "New chat" ? "Your local document assistant" : title}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Ask questions across your files. Qwen2.5 generates answers using
              retrieved MiniLM chunks from your local Qdrant index, with sources
              you can inspect.
            </p>
            <p className="mt-3 text-[10px] text-slate-600">
              Add files with the paperclip below, then choose a prompt to begin.
            </p>
          <div className="mx-auto mt-7 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
            {starterQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onPrompt(question)}
                className="rounded-xl border border-white/[0.07] bg-[#111827]/70 px-3.5 py-3 text-left text-xs leading-5 text-slate-400 transition hover:border-blue-400/25 hover:bg-blue-500/[0.06] hover:text-slate-200"
              >
                {question}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenDocuments}
            className="mt-6 text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition hover:text-slate-300"
          >
            View workspace documents
          </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[760px] space-y-7 px-4 py-8 sm:px-7 sm:py-10">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`flex gap-3.5 ${
                message.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                  message.role === "assistant"
                    ? "border border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-200"
                    : "border border-blue-300/15 bg-blue-400/[0.12] text-blue-100"
                }`}
              >
                {message.role === "assistant" ? (
                  <Bot size={16} />
                ) : (
                  <UserRound size={15} />
                )}
              </span>
              <div
                className={`min-w-0 max-w-[88%] ${
                  message.role === "user" ? "text-right" : ""
                }`}
              >
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  {message.role === "assistant" ? "Pipeline" : "You"}
                </p>
                <div
                  className={`inline-block rounded-2xl px-4 py-3 text-left ${
                    message.role === "assistant"
                      ? "max-w-full rounded-tl-md border border-white/[0.06] bg-[#111827] text-slate-300"
                      : "whitespace-pre-wrap rounded-tr-md border border-blue-400/10 bg-blue-500/[0.14] text-[13px] leading-6 text-blue-50"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <AssistantContent content={message.content} />
                  ) : (
                    message.content
                  )}
                </div>
                {message.delivery === "sending" && (
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
                    <LoaderCircle size={11} className="animate-spin" />
                    Waiting for a response
                  </p>
                )}
                {message.delivery === "failed" && (
                  <div
                    role="alert"
                    className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-rose-300"
                  >
                    <AlertCircle size={12} />
                    {message.error ?? "This message wasn't sent."}
                    <button
                      type="button"
                      onClick={() => onRetry(message)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-blue-300 transition hover:bg-blue-400/10 hover:text-cyan-200"
                    >
                      <RefreshCw size={11} /> Retry
                    </button>
                  </div>
                )}
                {message.role === "assistant" && (
                  <>
                    <CopyResponse content={message.content} />
                    <Sources message={message} />
                  </>
                )}
              </div>
            </article>
          ))}
          {sending && (
            <div className="flex items-center gap-3.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-200">
                <Bot size={16} />
              </span>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-white/[0.06] bg-[#111827] px-4 py-3 text-xs text-slate-500">
                <LoaderCircle size={14} className="animate-spin text-cyan-300" />
                Searching your documents...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
      {showScrollButton && (
        <button
          type="button"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="sticky bottom-4 ml-auto mr-4 grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-[#161f30] text-slate-300 shadow-lg transition hover:text-white"
          aria-label="Scroll to latest message"
        >
          <ArrowDown size={15} />
        </button>
      )}
    </section>
  );
}
