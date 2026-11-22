# RAG Document Chunking Pipeline — Local-First Semantic Search & QA Platform

**RAG Document Chunking Pipeline** is a full-stack, local-first Retrieval-Augmented Generation (RAG) workspace that lets users securely upload documents (PDF, DOCX, TXT, MD, CSV), parse and chunk text into dense vector embeddings, and ask natural-language questions grounded strictly in their private files—complete with transparent chunk inspection, similarity scores, and zero cloud LLM API costs.

---

## Key Features

- **End-to-End Ingestion & Chunking Pipeline:** Extracts text from multi-format documents (`pypdf`, `python-docx`), splits content into structured chunks, generates 384-dimensional dense embeddings via **Sentence-Transformers (`all-MiniLM-L6-v2`)**, and indexes payloads in **persistent on-disk Qdrant**.
- **Transparent Chunk & Citation Inspector:** Expandable source drawers beneath every assistant response display the exact source filename, chunk/page labels, cosine similarity scores, and retrieved chunk text snippets.
- **Unified ChatGPT-Style Workspace:** Single-page dark-themed interface featuring a live stack status pill (`Qwen2.5:3b · MiniLM-L6 · Qdrant`), starter prompt chips, inline document uploads with indexing status (`processing`, `completed`, `failed`), persistent per-user conversation history, and formatted Markdown/code responses with one-click copy controls.
- **Zero-Infrastructure Local Execution (No Docker, WSL, or External DB Server):** Runs completely offline on Windows, macOS, or Linux using **Ollama (`Qwen2.5:3b`)**, embedded **SQLite**, and file-based **Qdrant (`./qdrant_data`)**.
- **Dual-Database Architecture & Tenant Isolation:**
  - **SQLite (SQLAlchemy ORM):** Manages user authentication (JWT Bearer tokens), document ownership, and indexing lifecycle metadata with zero external database setup.
  - **Qdrant (Local Disk Storage):** Stores chunk vectors and metadata payloads filtered strictly by authenticated `user_id`.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, Axios |
| **Backend** | Python, FastAPI, Uvicorn, Pydantic v2, Passlib (`bcrypt`), JWT |
| **AI / Chunking & RAG** | Ollama (`qwen2.5:3b`), Sentence-Transformers (`all-MiniLM-L6-v2`), `pypdf`, `python-docx` |
| **Databases** | SQLite (SQLAlchemy ORM), Qdrant (Persistent Local Storage) |

---

## Architecture Overview

```text
[ React + TypeScript + Vite UI ]
              │  (JWT Bearer Auth)
              ▼
      [ FastAPI Backend ] ──► [ SQLite ] (Users, Document Metadata & Status)
              │
              ├──► [ Multi-Format Parser (pypdf / python-docx) + Text Chunking ]
              ├──► [ Sentence-Transformers (all-MiniLM-L6-v2) ] ──► [ Local Qdrant (./qdrant_data) ]
              └──► [ Ollama (qwen2.5:3b) ] ──► Grounded Answer + Chunk Inspector (Scores & Snippets)