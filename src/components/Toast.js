"use client";
import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.type === "success" && <span style={{ color: "var(--success)" }}>✓</span>}
            {toast.type === "error" && <span style={{ color: "var(--danger)" }}>✕</span>}
            {toast.type === "info" && <span style={{ color: "var(--text-dim)" }}>ℹ</span>}
            {toast.type === "warning" && <span style={{ color: "var(--warning)" }}>⚠</span>}
            <span style={{ fontSize: 14, fontWeight: 500 }}>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
