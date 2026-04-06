import React from 'react';

/**
 * A reusable pulsing skeleton component for loading states.
 */
const Skeleton = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = '8px', 
  margin = '0',
  style = {} 
}) => {
  return (
    <div 
      className="skeleton-pulse"
      style={{
        width,
        height,
        borderRadius,
        margin,
        backgroundColor: 'var(--gray-100)',
        ...style
      }}
    />
  );
};

// Add global styles for the pulse animation if not already present
// This should ideally be in index.css, but we can inject it here for convenience if needed.
// However, the user's project likely has an index.css.

export default Skeleton;

/**
 * Predefined Skeleton variants for common UI elements
 */
export const CardSkeleton = () => (
  <div style={{ padding: '16px', border: '1px solid var(--gray-100)', borderRadius: '16px', background: '#fff' }}>
    <Skeleton height="180px" marginBottom="16px" />
    <Skeleton width="40%" height="12px" marginBottom="12px" />
    <Skeleton width="90%" height="20px" marginBottom="16px" />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skeleton width="30%" height="24px" />
      <Skeleton width="40px" height="40px" borderRadius="50%" />
    </div>
  </div>
);

export const ListSkeleton = ({ count = 5 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    {Array(count).fill(0).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px' }}>
        <Skeleton width="50px" height="50px" borderRadius="8px" />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height="16px" marginBottom="8px" />
          <Skeleton width="40%" height="12px" />
        </div>
      </div>
    ))}
  </div>
);
