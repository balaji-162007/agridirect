import React, { createContext, useContext, useState, useCallback } from 'react';

/* ─── Context ─────────────────────────────────────── */
const ToastContext = createContext(null);

let _uid = 0;

/* ─── Provider (wrap your app or each page) ──────── */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success', duration = 3500) => {
    const id = ++_uid;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

/* ─── Hook ────────────────────────────────────────── */
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

/* ─── Container & individual Toast ───────────────── */
const ICONS = {
  success: '✅',
  error:   '❌',
  info:    'ℹ️',
  warning: '⚠️',
};

const COLORS = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', icon: '#16a34a', text: '#14532d' },
  error:   { bg: '#fef2f2', border: '#fecaca', icon: '#dc2626', text: '#7f1d1d' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', text: '#1e3a8a' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '#d97706', text: '#78350f' },
};

const ToastContainer = ({ toasts, onDismiss }) => (
  <div style={{
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '360px',
    width: 'calc(100vw - 48px)',
    pointerEvents: 'none',
  }}>
    {toasts.map(t => (
      <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
    ))}
  </div>
);

const ToastItem = ({ toast, onDismiss }) => {
  const c = COLORS[toast.type] || COLORS.info;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '12px',
        padding: '14px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        animation: 'toastSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        pointerEvents: 'all',
        cursor: 'default',
      }}
    >
      <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>{ICONS[toast.type]}</span>
      <span style={{
        flex: 1,
        fontSize: '0.9rem',
        fontWeight: 500,
        color: c.text,
        lineHeight: 1.5,
        fontFamily: 'inherit',
      }}>
        {toast.message}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          color: c.icon,
          padding: '0 0 0 4px',
          lineHeight: 1,
          opacity: 0.7,
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Keyframe injected once via a style tag */}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(60px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
};
