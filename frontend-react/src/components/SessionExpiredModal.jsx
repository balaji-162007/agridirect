import React from 'react';

const SessionExpiredModal = ({ isOpen, onLogin }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '420px',
        padding: '40px 32px',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        animation: 'modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          backgroundColor: '#fee2e2',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          color: '#ef4444'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h3 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#111827',
          marginBottom: '12px',
          fontFamily: 'inherit'
        }}>
          Session Expired
        </h3>
        
        <p style={{
          color: '#4b5563',
          lineHeight: 1.6,
          marginBottom: '32px',
          fontSize: '1rem'
        }}>
          Your security token has expired. Please log in again to continue your session safely.
        </p>

        <button 
          onClick={onLogin}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#2d8a56',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 6px -1px rgba(45, 138, 86, 0.2)'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#236b44'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#2d8a56'}
        >
          Return to Login
        </button>

        <style>
          {`
            @keyframes modalSlideUp {
              from { opacity: 0; transform: translateY(20px) scale(0.95); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default SessionExpiredModal;
