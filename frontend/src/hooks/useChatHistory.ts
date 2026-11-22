import { useEffect, useMemo, useState } from "react";

import type { ChatMessage, ChatThread } from "../types";

function createThread(): ChatThread {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function getStorageKey(email: string): string {
  return `enterpriseiq.chat-history.${email.toLowerCase()}`;
}

function getInitialState(email: string): {
  threads: ChatThread[];
  activeThreadId: string;
} {
  const threads = loadThreads(email);
  let storedActiveThreadId: string | null = null;
  try {
    storedActiveThreadId = localStorage.getItem(
      `${getStorageKey(email)}.active`,
    );
  } catch {
    storedActiveThreadId = null;
  }
  return {
    threads,
    activeThreadId:
      threads.find((thread) => thread.id === storedActiveThreadId)?.id ??
      threads[0]?.id ??
      "",
  };
}

function loadThreads(email: string): ChatThread[] {
  try {
    const stored = localStorage.getItem(getStorageKey(email));
    if (!stored) return [createThread()];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [createThread()];

    const validThreads = parsed.filter(
      (thread): thread is ChatThread =>
        typeof thread === "object" &&
        thread !== null &&
        typeof thread.id === "string" &&
        typeof thread.title === "string" &&
        typeof thread.updatedAt === "string" &&
        Array.isArray(thread.messages),
    );
    if (validThreads.length === 0) return [createThread()];

    return validThreads.map((thread) => ({
      ...thread,
      messages: thread.messages
        .filter(
          (message): message is ChatMessage =>
            typeof message === "object" &&
            message !== null &&
            typeof message.id === "string" &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string",
        )
        .map((message) =>
          message.delivery === "sending"
            ? { ...message, delivery: "failed" as const }
            : message,
        ),
    }));
  } catch {
    return [createThread()];
  }
}

export function useChatHistory(email: string) {
  const [initialState] = useState(() => getInitialState(email));
  const [threads, setThreads] = useState(initialState.threads);
  const [activeThreadId, setActiveThreadId] = useState(
    initialState.activeThreadId,
  );

  useEffect(() => {
    const state = getInitialState(email);
    setThreads(state.threads);
    setActiveThreadId(state.activeThreadId);
  }, [email]);

  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(email), JSON.stringify(threads));
      localStorage.setItem(
        `${getStorageKey(email)}.active`,
        activeThreadId,
      );
    } catch {
      // Keep the current chat usable if browser storage is unavailable or full.
    }
  }, [email, threads, activeThreadId]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId],
  );

  const updateThread = (
    threadId: string,
    update: (thread: ChatThread) => ChatThread,
  ) => {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? update(thread) : thread,
      ),
    );
  };

  const newThread = () => {
    const thread = createThread();
    setThreads((current) => [thread, ...current]);
    setActiveThreadId(thread.id);
  };

  const deleteThread = (threadId: string) => {
    const remaining = threads.filter((thread) => thread.id !== threadId);
    if (threadId === activeThreadId) {
      const next = remaining[0] ?? createThread();
      if (remaining.length === 0) remaining.push(next);
      setActiveThreadId(next.id);
    }
    setThreads(remaining);
  };

  const clearHistory = () => {
    const thread = createThread();
    setThreads([thread]);
    setActiveThreadId(thread.id);
  };

  const appendMessage = (threadId: string, message: ChatMessage) => {
    updateThread(threadId, (thread) => {
      const firstUserMessage =
        message.role === "user" &&
        !thread.messages.some((item) => item.role === "user");
      return {
        ...thread,
        title: firstUserMessage
          ? message.content.slice(0, 52).trim() || "New chat"
          : thread.title,
        updatedAt: new Date().toISOString(),
        messages: [...thread.messages, message],
      };
    });
  };

  const updateMessage = (
    threadId: string,
    messageId: string,
    update: (message: ChatMessage) => ChatMessage,
  ) => {
    updateThread(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      messages: thread.messages.map((message) =>
        message.id === messageId ? update(message) : message,
      ),
    }));
  };

  return {
    threads,
    activeThread,
    activeThreadId: activeThread?.id ?? activeThreadId,
    selectThread: setActiveThreadId,
    newThread,
    deleteThread,
    clearHistory,
    appendMessage,
    updateMessage,
  };
}
