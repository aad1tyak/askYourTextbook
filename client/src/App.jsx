// client/src/App.jsx
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import Modal from "bootstrap/js/dist/modal";

const BASE_URL = "http://127.0.0.1:8000"; // Change to your backend URL

export default function App() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileNames, setFileNames] = useState([]);
  const [selectedFile, setSelectedFile] = useState([]);
  const [uploadFileName, setUploadFileName] = useState("");
  const [message, setMessage] = useState([]);

  useEffect(() => {
    if (!selectedFile || selectedFile.length === 0) {
      setMessage([
        {
          sender: "assistant",
          text: "Please upload or select a file.",
        },
      ]);
    } else {
      setMessage([
        {
          sender: "assistant",
          text: `Hello! I am ready to help you with ${selectedFile}'s questions.`,
        },
      ]);
    }
  }, [selectedFile]);
  const [k, setK] = useState(5); // Default value for k
  const [rag, setRag] = useState(false); // RAG toggle state

  const modalRef = useRef(null);
  const modalInstance = useRef(null);

  useEffect(() => {
    if (modalRef.current) {
      modalInstance.current = new Modal(modalRef.current, {
        backdrop: "static",
        keyboard: false,
      });
    }
  }, []);


  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [message]);

  const openModal = () => {
    modalInstance.current?.show();
  };

  const closeModal = () => {
    modalInstance.current?.hide();
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append('fileName', uploadFileName.replace(/ /g, "_"));

    try {
      const uploadRes = await axios.post(`${BASE_URL}/upload`, formData);
      if (uploadRes.data?.status === "success") {
        closeModal();
      } else {
        alert("Upload failed: Invalid response");
      }
    } catch (err) {
      alert("Upload failed: " + err.message);
    }

    setUploading(false);
  };

  const sendMessage = async () => {
    const input = document.querySelector("textarea");
    const text = input.value.trim();
    if (!text) return;

    setMessage((prev) => [...prev, { id: Date.now(), sender: "user", text }]);
    input.value = "";

    try {
      const response = await axios.post(`${BASE_URL}/ask`, {
        question: text,
        k: k,
        rag: rag ? "true" : "false",
        fileName: selectedFile,
      });
      let botMessage = response.data.answer;
      if (!botMessage || typeof botMessage !== "string") {
        console.error("Unexpected bot response:", botMessage);
        botMessage = "Sorry, I couldn't understand the response.";
      }
      setMessage((prev) => [
        ...prev,
        { sender: "assistant", text: botMessage },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessage((prev) => [
        ...prev,
        { sender: "assistant", text: "Error processing your request." },
      ]);
    }
  };

  
  useEffect(() => {
    axios
      .get(`${BASE_URL}/fileNames`)
      .then((res) => {
        if (Array.isArray(res.data)) {
          setFileNames(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch file names:", err);
      });
  }, []);


  // Helper to check if uploadFileName is valid and unique
  const isFileNameValid = () => {
    const trimmed = uploadFileName.trim();
    if (!trimmed) return false;
    // Check for duplicate (case-insensitive)
    return !fileNames.some(
      (name) => name.toLowerCase() === trimmed.toLowerCase()
    );
  };

  // Error message for duplicate or empty file name
  const fileNameError = (() => {
    if (!uploadFileName.trim()) return "Please enter a file name.";
    if (
      fileNames.some(
        (name) => name.toLowerCase() === uploadFileName.trim().toLowerCase()
      )
    )
      return "File name already exists. Please choose a unique name.";
    return "";
  })();

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="dropdown">
          <button
            className="btn btn-primary dropdown-toggle"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            style={{
              border: "none",
              fontWeight: 400,
              letterSpacing: "0.5px",
            }}
          >
            <i className="bi bi-file-earmark-text me-2"></i>
            Select Your File
          </button>
          <ul
            className="dropdown-menu shadow"
            style={{
              minWidth: "220px",
              borderRadius: "0.75rem",
              border: "none",
              background: "#f8fafc",
              boxShadow: "0 4px 24px rgba(37,99,235,0.08)",
            }}
          >
            <li>
              <button
                className="dropdown-item d-flex align-items-center gap-2 py-2"
                style={{
                  color: "#2563eb",
                  fontWeight: 500,
                  borderRadius: "0.5rem",
                  transition: "background 0.2s",
                }}
                onClick={openModal}
              >
                <i className="bi bi-upload"></i>
                Import New File
              </button>
            </li>
            <li>
              <hr className="dropdown-divider" />
            </li>
            {fileNames.length === 0 && (
              <li>
                <span className="dropdown-item text-muted small">
                  No files found
                </span>
              </li>
            )}
            {fileNames.map((name) => (
              <li key={name}>
                <button
                  className={`dropdown-item d-flex align-items-center gap-2 py-2 ${
                    selectedFile === name ? "active" : ""
                  }`}
                  style={{
                    borderRadius: "0.5rem",
                    background:
                      selectedFile === name
                        ? "linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)"
                        : "transparent",
                    color: selectedFile === name ? "#fff" : "#1e293b",
                    fontWeight: selectedFile === name ? 600 : 500,
                    transition: "background 0.2s, color 0.2s",
                  }}
                  onClick={() => setSelectedFile(name)}
                >
                  <i className="bi bi-file-earmark-text"></i>
                  {name}
                  {selectedFile === name && (
                    <i className="bi bi-check-circle-fill ms-auto"></i>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="modal fade" tabIndex="-1" ref={modalRef}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">Upload PDF</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={closeModal}
                disabled={uploading}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <input
                type="file"
                className="form-control"
                accept="application/pdf"
                onChange={handleFileChange}
              />
            </div>
            <div className="modal-footer flex-column align-items-stretch">
              <input
                type="text"
                className="form-control mb-2"
                placeholder="Enter unique file name"
                value={uploadFileName}
                onChange={e => setUploadFileName(e.target.value)}
                maxLength={50}
                required
                style={{ width: "100%" }}
                autoFocus
              />
              {fileNameError && (
                <div className="text-danger small mb-2">{fileNameError}</div>
              )}
              <button
                className="btn btn-success"
                onClick={handleUpload}
                disabled={
                  !file ||
                  uploading ||
                  !uploadFileName.trim() ||
                  !isFileNameValid()
                }
              >
                {uploading ? "Uploading..." : "Upload & Process"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm flex-grow-1 d-flex flex-column">
        <div
          className="card-body overflow-auto"
          ref={chatBodyRef}
          style={{ maxHeight: "100%" }}
        >
          {message.map((msg) =>
            msg.sender === "user" ? (
              <div key={msg.id} className="d-flex justify-content-end mb-3">
                <div
                  className="bg-light p-2 rounded"
                  style={{ maxWidth: "75%" }}
                >
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div key={msg.id} className="d-flex mb-3">
                <div
                  className="bg-primary text-white p-2 rounded"
                  style={{ maxWidth: "75%" }}
                >
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            )
          )}
        </div>

        <div className="card-footer bg-light">
          <div className="input-group">
            <textarea
              className="form-control"
              placeholder="What's on your mind..."
              rows="1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            ></textarea>
            <div className="input-group-append d-flex align-items-center">
              <input
                type="number"
                className="form-control"
                style={{ maxWidth: "70px" }}
                min="1"
                max="20"
                value={k}
                onChange={(e) => setK(Number(e.target.value))}
              />
              <div className="form-check ms-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={rag}
                  onChange={(e) => setRag(e.target.checked)}
                  id="ragCheckbox"
                />
                <label className="form-check-label" htmlFor="ragCheckbox">
                  RAG
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
