import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  FileStack,
  Menu,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";

import { useChatHistory } from "../hooks/useChatHistory";
import { useAuth } from "../context/AuthContext";
import {
  documentsApi,
  getApiErrorMessage,
  ragApi,
} from "../services/api";
import type { ChatMessage, DocumentItem } from "../types";
import ChatPanel from "./ChatPanel";
import Composer from "./Composer";
import DocumentDrawer from "./DocumentDrawer";
import Sidebar from "./Sidebar";

export default function ChatWorkspace() {
  const { email, logout } = useAuth();
  const accountEmail = email ?? "workspace-user";
  const history = useChatHistory(accountEmail);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [retryingIds, setRetryingIds] = useState<Set<number>>(() => new Set());
  const [dragging, setDragging] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(() => new Set());

  const refreshDocuments = useCallback(async () => {
    try {
      const currentDocuments = await documentsApi.list();
      setDocuments(currentDocuments);
      setDocumentsError("");
    } catch (error) {
      setDocumentsError(getApiErrorMessage(error));
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    if (!documents.some((document) => document.processing_status === "processing")) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void refreshDocuments();
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [documents, refreshDocuments]);

  const activeThread = history.activeThread;
  const activeMessages = activeThread?.messages ?? [];
  const sending = activeMessages.some(
    (message) => message.delivery === "sending" && sendingIds.has(message.id),
  );
  const readyCount = useMemo(
    () =>
      documents.filter((document) => document.processing_status === "completed")
        .length,
    [documents],
  );

  const sendMessage = async (
    threadId: string,
    message: ChatMessage,
  ): Promise<void> => {
    setSendingIds((current) => new Set(current).add(message.id));
    history.updateMessage(threadId, message.id, (current) => ({
      ...current,
      delivery: "sending",
    }));

    try {
      const result = await ragApi.query(message.content);
      history.updateMessage(threadId, message.id, (current) => ({
        ...current,
        delivery: "sent",
      }));
      history.appendMessage(threadId, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        sources: result.sources,
        delivery: "sent",
      });
    } catch (error) {
      history.updateMessage(threadId, message.id, (current) => ({
        ...current,
        delivery: "failed",
        error: getApiErrorMessage(error),
      }));
    } finally {
      setSendingIds((current) => {
        const next = new Set(current);
        next.delete(message.id);
        return next;
      });
    }
  };

  const submitPrompt = (prompt: string) => {
    if (!activeThread) return;
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      delivery: "sending",
    };
    history.appendMessage(activeThread.id, message);
    void sendMessage(activeThread.id, message);
  };

  const retryMessage = (message: ChatMessage) => {
    if (!activeThread || sending) return;
    void sendMessage(activeThread.id, message);
  };

  const uploadDocument = async (
    file: File,
    onProgress: (progress: number) => void,
  ): Promise<DocumentItem> => {
    try {
      const document = await documentsApi.upload(file, onProgress);
      await refreshDocuments();
      return document;
    } catch (error) {
      await refreshDocuments();
      throw new Error(getApiErrorMessage(error));
    }
  };

  const retryDocument = async (documentId: number) => {
    setRetryingIds((current) => new Set(current).add(documentId));
    try {
      const updated = await documentsApi.process(documentId);
      setDocuments((current) =>
        current.map((document) =>
          document.id === documentId ? updated : document,
        ),
      );
      setDocumentsError("");
    } catch (error) {
      setDocumentsError(getApiErrorMessage(error));
      await refreshDocuments();
    } finally {
      setRetryingIds((current) => {
        const next = new Set(current);
        next.delete(documentId);
        return next;
      });
    }
  };

  const uploadDroppedFile = (file?: File) => {
    if (!file) return;
    void uploadDocument(file, () => undefined).catch((error: unknown) => {
      setDocumentsError(getApiErrorMessage(error));
      setDocumentsOpen(true);
    });
  };

  const sortedThreads = [...history.threads].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

  return (
    <div
      className="flex h-[100dvh] min-h-[480px] overflow-hidden bg-[#0b0f17] text-slate-200"
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (
          event.target instanceof Element &&
          event.target.closest("[data-composer-dropzone]")
        ) {
          return;
        }
        uploadDroppedFile(event.dataTransfer.files[0]);
      }}
    >
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-black/60 lg:hidden"
        />
      )}
      <div
        className={`${
          mobileSidebarOpen
            ? "fixed inset-y-0 left-0 z-40 block"
            : "hidden lg:block"
        }`}
      >
        <Sidebar
          email={email ?? "Workspace user"}
          threads={sortedThreads}
          activeThreadId={history.activeThreadId}
          documentCount={documents.length}
          collapsed={sidebarCollapsed}
          mobile={mobileSidebarOpen}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          onClose={() => setMobileSidebarOpen(false)}
          onNewChat={history.newThread}
          onSelectThread={history.selectThread}
          onDeleteThread={history.deleteThread}
          onClearHistory={history.clearHistory}
          onOpenDocuments={() => setDocumentsOpen(true)}
          onSignOut={logout}
        />
      </div>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-10 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-white/[0.065] bg-[#0b0f17]/95 px-3 backdrop-blur-md sm:h-[66px] sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (window.matchMedia("(min-width: 1024px)").matches) {
                  setSidebarCollapsed((current) => !current);
                } else {
                  setMobileSidebarOpen(true);
                }
              }}
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <Menu size={19} />
              )}
            </button>
            <span className="truncate text-[13px] font-medium text-slate-200 sm:text-sm">
              {activeThread?.title ?? "New chat"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDocumentsOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#111827] px-2.5 text-[10px] text-slate-300 transition hover:border-cyan-300/20 hover:text-white sm:gap-2 sm:px-3 sm:text-[11px]"
            >
              <FileStack size={13} className="text-cyan-300" />
              <span>{documents.length}</span>
              <span className="hidden text-slate-500 sm:inline">files</span>
              <span className="hidden text-slate-600 xl:inline">
                · {readyCount} ready
              </span>
            </button>
            <span
              title="Active local pipeline: Qwen2.5:3b, MiniLM-L6, and Qdrant"
              className="hidden h-8 items-center gap-1.5 rounded-full border border-cyan-300/10 bg-cyan-300/[0.04] px-3 text-[10px] text-cyan-100/80 md:inline-flex"
            >
              <Sparkles size={12} className="text-cyan-300" />
              Qwen2.5:3b · MiniLM-L6 · Qdrant
            </span>
            <span
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-2.5 text-[10px] text-emerald-300 sm:px-3 sm:text-[11px]"
              title="Chat history is stored in this browser"
            >
              <Check size={12} /> <span className="hidden sm:inline">Private</span>
            </span>
          </div>
        </header>

        <ChatPanel
          title={activeThread?.title ?? "New chat"}
          messages={activeMessages}
          sending={sending}
          onPrompt={submitPrompt}
          onRetry={retryMessage}
          onOpenDocuments={() => setDocumentsOpen(true)}
        />
        <Composer
          sending={sending}
          onSend={submitPrompt}
          onUpload={uploadDocument}
          onRetryDocument={retryDocument}
          onOpenDocuments={() => setDocumentsOpen(true)}
        />

        {dragging && (
          <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-2xl border border-dashed border-cyan-300/40 bg-[#0b0f17]/90 text-sm font-medium text-cyan-100 backdrop-blur-sm">
            Drop a PDF, DOCX, TXT, MD, or CSV to add it to your workspace
          </div>
        )}
      </main>

      {documentsOpen && (
        <DocumentDrawer
          documents={documents}
          loading={documentsLoading}
          error={documentsError}
          retryingIds={retryingIds}
          onClose={() => setDocumentsOpen(false)}
          onRefresh={() => void refreshDocuments()}
          onRetry={(documentId) => void retryDocument(documentId)}
        />
      )}
    </div>
  );
}
