export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DocumentItem {
  id: number;
  user_id: number;
  filename: string;
  file_size: number;
  file_type: string;
  processing_status: "processing" | "completed" | "failed" | string;
  chunk_count?: number;
  created_at: string;
}

export interface SourceChunkCitation {
  chunk_index: number;
  text: string;
  score?: number;
  page_number?: number;
}

export interface SourceCitation {
  document_id: number;
  filename: string;
  chunk_indices: number[];
  chunks?: SourceChunkCitation[];
}

export interface RAGResponse {
  answer: string;
  sources: SourceCitation[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceCitation[];
  delivery?: "sending" | "sent" | "failed";
  error?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}
