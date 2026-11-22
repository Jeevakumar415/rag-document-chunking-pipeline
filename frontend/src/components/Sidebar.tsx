import {
  Atom,
  ChevronLeft,
  FileStack,
  LogOut,
  MessageSquarePlus,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from "lucide-react";

import type { ChatThread } from "../types";

interface SidebarProps {
  email: string;
  threads: ChatThread[];
  activeThreadId: string;
  documentCount: number;
  collapsed: boolean;
  mobile: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onClearHistory: () => void;
  onOpenDocuments: () => void;
  onSignOut: () => void;
}

function threadDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Sidebar({
  email,
  threads,
  activeThreadId,
  documentCount,
  collapsed,
  mobile,
  onToggleCollapsed,
  onClose,
  onNewChat,
  onSelectThread,
  onDeleteThread,
  onClearHistory,
  onOpenDocuments,
  onSignOut,
}: SidebarProps) {
  const compact = collapsed && !mobile;

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-white/[0.07] bg-[#0b0f17] transition-[width] duration-200 ${
        mobile ? "w-[min(88vw,320px)]" : compact ? "w-[72px]" : "w-[280px]"
      }`}
    >
      <div
        className={`flex h-[68px] shrink-0 items-center ${
          compact ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        {compact ? (
          <button
            type="button"
            title="Expand sidebar"
            aria-label="Expand sidebar"
            onClick={onToggleCollapsed}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <PanelLeftOpen size={18} />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_0_24px_rgba(37,99,235,0.22)]">
                <Atom size={18} />
              </span>
              <span className="max-w-[138px] text-[12px] font-semibold leading-4 tracking-tight text-slate-100">
                RAG Document <span className="text-cyan-300">Chunking Pipeline</span>
              </span>
            </div>
            <button
              type="button"
              onClick={mobile ? onClose : onToggleCollapsed}
              title={mobile ? "Close sidebar" : "Collapse sidebar"}
              aria-label={mobile ? "Close sidebar" : "Collapse sidebar"}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
            >
              {mobile ? <ChevronLeft size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </>
        )}
      </div>

      <div className={`shrink-0 ${compact ? "px-2" : "px-3"}`}>
        <button
          type="button"
          onClick={() => {
            onNewChat();
            if (mobile) onClose();
          }}
          title={compact ? "New chat" : undefined}
          className={`flex h-10 w-full items-center gap-2.5 rounded-xl border border-blue-400/20 bg-blue-500/[0.12] text-sm font-medium text-blue-100 transition hover:border-blue-300/35 hover:bg-blue-500/[0.19] ${
            compact ? "justify-center px-0" : "px-3"
          }`}
        >
          <MessageSquarePlus size={17} className="shrink-0 text-cyan-300" />
          {!compact && "New chat"}
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenDocuments();
            if (mobile) onClose();
          }}
          title={compact ? "Workspace documents" : undefined}
          className={`mt-2 flex h-10 w-full items-center gap-2.5 rounded-xl text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-100 ${
            compact ? "justify-center px-0" : "px-3"
          }`}
        >
          <FileStack size={17} className="shrink-0 text-slate-400" />
          {!compact && (
            <>
              <span className="flex-1 text-left">Workspace files</span>
              <span className="min-w-6 rounded-full border border-white/[0.07] bg-white/[0.04] px-1.5 py-0.5 text-center text-[10px] text-slate-300">
                {documentCount}
              </span>
            </>
          )}
        </button>
      </div>

      {!compact && (
        <div className="mt-7 flex min-h-0 flex-1 flex-col px-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-500">
              Recent chats
            </p>
            {threads.some((thread) => thread.messages.length > 0) && (
              <button
                type="button"
                onClick={onClearHistory}
                title="Clear chat history"
                aria-label="Clear chat history"
                className="rounded-md p-1 text-slate-600 transition hover:bg-white/[0.06] hover:text-rose-300"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <nav
            aria-label="Chat history"
            className="min-h-0 flex-1 space-y-1 overflow-y-auto pb-4"
          >
            {threads.map((thread) => {
              const active = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  className={`group flex items-center gap-1 rounded-xl border transition ${
                    active
                      ? "border-white/[0.07] bg-[#161f30] text-slate-100"
                      : "border-transparent text-slate-400 hover:bg-white/[0.035] hover:text-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectThread(thread.id);
                      if (mobile) onClose();
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left"
                  >
                    <MessagesSquare
                      size={15}
                      className={`shrink-0 ${active ? "text-cyan-300" : "text-slate-600"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">
                        {thread.title}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-600">
                        {thread.messages.length
                          ? threadDate(thread.updatedAt)
                          : "New conversation"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteThread(thread.id)}
                    title="Delete chat"
                    aria-label={`Delete ${thread.title}`}
                    className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-600 opacity-0 transition hover:bg-rose-400/10 hover:text-rose-300 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </nav>
          <div className="mb-3 rounded-xl border border-cyan-400/[0.09] bg-cyan-400/[0.035] px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-300">
              Your private workspace
            </p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">
              Answers are grounded in your uploaded documents.
            </p>
          </div>
        </div>
      )}

      {compact && <div className="flex-1" />}
      <div
        className={`flex shrink-0 items-center border-t border-white/[0.07] py-3 ${
          compact ? "justify-center px-2" : "gap-2.5 px-4"
        }`}
      >
        <span
          title={email}
          aria-label={`Signed in as ${email}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-blue-300/15 bg-gradient-to-br from-blue-400/20 to-cyan-400/10 text-[11px] font-semibold text-blue-100"
        >
          {email.slice(0, 1).toUpperCase()}
        </span>
        {compact ? (
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-100"
          >
            <LogOut size={15} />
          </button>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">
              {email}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-100"
            >
              <LogOut size={15} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
