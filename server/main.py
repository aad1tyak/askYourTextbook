# backend/main.py
from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uuid
from sentence_transformers import SentenceTransformer
import faiss
import cohere
from pydantic import BaseModel
from dotenv import load_dotenv
import os
load_dotenv()
from functools import lru_cache
import threading
write_lock = threading.Lock()



class AskRequest(BaseModel):
    question: str
    rag: str = "true"
    k: int = 3
    fileName: str = None

app = FastAPI()

co = cohere.ClientV2(os.getenv('COHERE_API_KEY'))

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
VECTOR_INDEX_PATH = "vector.index"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Load embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Global store for all chunks
chunks_store = []

FAISS_INDEX_DIR = "faiss_index"
os.makedirs(FAISS_INDEX_DIR, exist_ok=True)

CHUNK_DELIMITER = "=" * 30  # Unique delimiter for chunk separation

def get_faiss_index_path(file_name):
    return os.path.join(FAISS_INDEX_DIR, f"{file_name}.index")

# Dictionary to hold in-memory indices for each file
faiss_indices = {}
file_chunks_store = {}

# Define a maximum number of FAISS indices to keep in memory
MAX_CACHED_FAISS_INDICES = 10 # Adjust based on your available RAM and average index size

# Update load_faiss_index to use caching
@lru_cache(maxsize=MAX_CACHED_FAISS_INDICES)
def load_faiss_index_cached(file_name):
    index_path = get_faiss_index_path(file_name)
    if os.path.exists(index_path) and os.path.getsize(index_path) > 0:
        try:
            index = faiss.read_index(index_path)
            print(f"Loaded index for {file_name} from disk.") # For debugging
        except RuntimeError:
            print(f"Error reading index for {file_name}, creating new one.")
            index = faiss.IndexFlatL2(384)
    else:
        print(f"Index file not found for {file_name}, creating new one.")
        index = faiss.IndexFlatL2(384)
    return index


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    fileName: str = Form(...)
):
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{fileName}.pdf")

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        text_data = extract_text_from_pdf(file_path)
        if not text_data.strip():
            print("No text extracted from PDF. The file may be empty or not a valid PDF.")
            return JSONResponse(status_code=400, content={"error": "No text extracted from PDF. The file may be empty or not a valid PDF."})
    except ImportError as e:
        print(f"ImportError: {e}")
        return JSONResponse(status_code=500, content={"error": f"PyMuPDF (fitz) is not installed. Please install it with 'pip install pymupdf'. Details: {str(e)}"})
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Exception during PDF extraction: {error_details}")
        return JSONResponse(status_code=500, content={"error": f"Failed to extract text from PDF: {str(e)}", "details": error_details})

    chunked_data = chunk_text_with_overlap(
        text_data
    )

    output_dir = "chunked_pdfs"
    os.makedirs(output_dir, exist_ok=True)
    chunked_output_path = os.path.join(output_dir, f"{fileName}.txt")
    with open(chunked_output_path, "w", encoding="utf-8") as out:
        out.write(f"{CHUNK_DELIMITER}\n".join(chunked_data))

    embeddings = model.encode(chunked_data)
    index = load_faiss_index_cached(fileName)
    index.add(embeddings)
    faiss.write_index(index, get_faiss_index_path(fileName))
    
    return {
        "file_id": file_id,
        "status": "success",
        "chunks": len(chunked_data)
    }



@app.post("/ask")
def ask_question(req: AskRequest):
    question = req.question
    rag = req.rag.lower()
    k = req.k
    context = ""
    fileName = None  # Assign a default value or retrieve from request if needed

    if rag == "true":
        # fileName should be provided in the request; here we try to get it from the request if possible
        if not hasattr(req, "fileName") or not req.fileName:
            return {"error": "fileName must be provided for RAG search."}
        fileName = req.fileName

        # Load the correct FAISS index for the file
        index = load_faiss_index_cached(fileName)

        # Load the correct chunked text for the file
        chunked_file_path = os.path.join("chunked_pdfs", f"{fileName}.txt")
        if not os.path.exists(chunked_file_path):
            return {"error": f"Chunked text for file '{fileName}' not found."}
        with open(chunked_file_path, "r", encoding="utf-8") as f:
            chunked_text = f.read()
        chunks = chunked_text.split(f"{CHUNK_DELIMITER}\n")

        query_embedding = model.encode([question])
        _, I = index.search(query_embedding, max(k * 3, k + 5))
        matched_chunks = [chunks[i] for i in I[0] if i < len(chunks)]

        chunk_sorting_response = co.rerank(
            model="rerank-english-v3.0",
            query=question,
            documents=[{"text": chunk} for chunk in matched_chunks]
        )
        ranked = sorted(chunk_sorting_response.results, key=lambda d: d.relevance_score, reverse=True)
        top_chunks = [matched_chunks[result.index] for result in ranked[:k]]
        context = f"\n{CHUNK_DELIMITER}\n".join(top_chunks)
    
    
        prompt = (
    "You are a Retrieval-Augmented Generation (RAG) assistant designed to answer academic and textbook-related questions using the provided context.\n"
    "Your role is to interpret the user's question with care and answer using the most relevant and logically connected parts of the context.\n\n"
    "If the exact answer isn't stated, you should:\n"
    "- Look for related definitions, examples, or references.\n"
    "- Make reasoned inferences based on similar topics or sections.\n"
    "- Clearly state when you're guessing or inferring, and explain your reasoning.\n\n"
    "Avoid fabricating information, but do not reject a question outright if a plausible answer can be drawn from the context.\n"
    "Use Markdown formatting for any equations: wrap inline math in `$...$` and block math in `$$...$$`.\n\n"
    "Your tone should be informative and neutral, and your explanations should be detailed but not overly verbose.\n\n"
    "Finally at the end of your response please let me know how much the provided context was usefull, on a scale from 1 to 5, where 1 is not useful at all and 5 is extremely useful.\n\n"
    f"CONTEXT START:\n{context}\nCONTEXT END.\n\n"
    f"USER QUESTION:\n{question}\n\n"
    f"ANSWER:"
)

    else:
        prompt = question

    response = co.chat(
        model="command-a-03-2025",
        temperature=0.5,
        messages=[{"role": "user", "content": prompt}],
    )

    answer_text = response.message.content[0].text if response and response.message else ""

    # Append results to result.txt
    with write_lock:
        with open('result.txt', 'a', encoding='utf-8') as f:
            f.write(f"\nQuestion: {question}\n")
            f.write(f"Context: {context if rag == 'true' else 'No context'}\n")
            f.write(f"Answer: {answer_text}\n")
            f.write("-" * 80 + "\n")

    return {"answer": answer_text, "context": context if rag == "true" else ""}




@app.get("/fileNames")
def get_fileNames():
    folder = "chunked_pdfs"
    if not os.path.exists(folder):
        return []
    file_names = [os.path.splitext(f)[0] for f in os.listdir(folder) if os.path.isfile(os.path.join(folder, f))]
    return file_names







def extract_text_from_pdf(path: str) -> str:
    import fitz  # PyMuPDF
    text = ""
    with fitz.open(path) as doc:
        for page in doc:
            text += page.get_text()
    return text



def chunk_text_with_overlap(text: str, lines_per_chunk: int = 10, overlap: int = 4) -> list:
    lines = text.splitlines()
    chunks = []
    
    for i in range(0, len(lines), lines_per_chunk - overlap):
        chunk = '\n'.join(lines[i:i + lines_per_chunk])
        if chunk:
            chunks.append(chunk)
    
    return chunks


