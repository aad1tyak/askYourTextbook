This guide helps you set up the project locally. It covers both the **FastAPI backend** and **React frontend**.

---

## 🧰 Prerequisites

### 1. Python Setup

* Install Python 3.10 or newer:

  * [Download Python](https://www.python.org/downloads/)
  * Make sure to check **"Add Python to PATH"** during installation

### 2. Node.js & npm

* Install Node.js (which includes npm):

  * [Download Node.js LTS](https://nodejs.org/en/)

---

## 📂 Folder Structure

```
root/
├── server/            # FastAPI backend
│   └── main.py
│   └── requirements.txt
├── client/            # React frontend (Vite)
│   └── package.json
│   └── vite.config.js
```

---

## 🚀 Backend Setup (FastAPI)

### Create & activate virtual environment for backend

Note: This step is required ONLY during the initial deployment.
```bash
cd server
python -m venv venv 
source venv/bin/activate  # On Windows: venv\Scripts\activate  
pip install -r requirements.txt
```

### Run your backend in the `server/` folder
```bash
uvicorn main:app --reload --port 8000 #Run the backend on port:8000
```

### Create `.env` file

Create a `.env` in the `server/` folder:

```
COHERE_API_KEY=your_actual_key_here
```
Visit: [https://dashboard.cohere.com/api-keys](Cohere API Keys) to get your API key

---

## 💻 Frontend Setup (React + Vite)

### Install dependencies for frontend

Note: This step is required ONLY during the initial deployment.
```bash
cd client
npm install
```

### Run your frontend in the `client/` folder
```bash
npm run dev #Run the frontend at port:5173
```
Visit: [http://localhost:5173](http://localhost:5173)

---

## 🚀 How does it work?

This project is a lightweight, server-hosted RAG (Retrieval-Augmented Generation) system that allows users to upload a PDF and ask questions based on its content — all powered by vector embeddings and Cohere’s large language model.

### 🧠 Step-by-step Breakdown

1. **📤 Upload a PDF**  
   Send a `POST` request to `/upload` with your PDF file.

2. **📄 Text Extraction**  
   The PDF is processed using `PyMuPDF`, which extracts clean, raw text from each page.

3. **🔪 Text Chunking**  
   The extracted text is chunked using section headings like `Definition`, `Theorem`, `Example`, etc., via regex-based splitting.

4. **🧬 Chunk Embedding**  
   Each chunk is embedded using `SentenceTransformer("all-MiniLM-L6-v2")`, converting it into a **384-dimensional vector**.  
   These vectors are stored in a **FAISS index** for fast similarity search.

5. **❓ Ask a Question**  
   You send a question via a `POST` request to `/context`.  
   The system:
   - Embeds the question using the same model
   - Searches the FAISS index for the **top-k most similar chunks** (default `k=5`)

6. **🧠 Context-Aware Answering**  
   A custom RAG prompt is built using your question and the retrieved chunks.  
   This prompt is sent to **Cohere's LLM**, which generates an answer based only on that context (zero hallucination).

7. **💬 Final Output**  
   You receive an accurate, context-grounded answer — just like chatting with your textbook!

---

## 🛠️ Upcoming Features

- **🔁 Chat History**  
  Previous questions and responses will be saved for a more coherent conversation.

- **🧠 Memory**  
  The AI will remember your previous chats for better follow-ups.

- **📏 Chunking Flexibility**  
  Customize how the text is chunked — sentence-level, paragraph-level, or hybrid.

- **📝 Custom Prompting**  
  Use your own RAG prompt templates to guide how the AI answers.

- **📊 Reranking for Relevance**  
  Retrieved chunks will be reranked using additional signals for more accurate answers.

- **🖼️ Image Embedding (Coming Soon)**  
  Upload textbook images — the system will extract and embed visual content for image-based QA.

---
