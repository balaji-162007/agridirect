import React, { useState, useEffect, useRef } from 'react';
import { getFullImageUrl } from '../services/api';

/**
 * ProductImageSlider
 * Now uses native horizontal scrolling with scroll-snap for a smooth, performant experience.
 * Supports automatic cycling and manual scrolling.
 */
const ProductImageSlider = ({ images, alt, activeIndex = 0, onChange = null, autoCycle = true }) => {
  const [internalIndex, setInternalIndex] = useState(activeIndex);
  const sliderRef = useRef(null);
  const isScrollingInternal = useRef(false);

  // Sync internal state with external activeIndex prop (from ProductDetail)
  useEffect(() => {
    if (activeIndex !== internalIndex && sliderRef.current && !isScrollingInternal.current) {
      const slider = sliderRef.current;
      slider.scrollTo({
        left: slider.offsetWidth * activeIndex,
        behavior: 'smooth'
      });
      setInternalIndex(activeIndex);
    }
  }, [activeIndex]);

  // Handle automatic cycling (mostly for ProductCard listings)
  useEffect(() => {
    if (!images || images.length <= 1 || !autoCycle) return;

    const interval = setInterval(() => {
      if (!sliderRef.current) return;
      const slider = sliderRef.current;
      const nextIndex = (internalIndex + 1) % images.length;
      
      isScrollingInternal.current = true;
      slider.scrollTo({
        left: slider.offsetWidth * nextIndex,
        behavior: 'smooth'
      });
      setInternalIndex(nextIndex);
      
      // Reset the lock after animation finishes
      setTimeout(() => { isScrollingInternal.current = false; }, 600);
    }, 4500);

    return () => clearInterval(interval);
  }, [images, autoCycle, internalIndex]);

  // Updates index based on scroll position (manual swipe/scroll)
  const handleScroll = (e) => {
    if (!sliderRef.current || isScrollingInternal.current) return;
    const slider = e.currentTarget;
    const newIndex = Math.round(slider.scrollLeft / slider.offsetWidth);
    if (newIndex !== internalIndex) {
      setInternalIndex(newIndex);
      if (onChange) onChange(newIndex);
    }
  };

  if (!images || images.length === 0) {
    return <div className="product-image-placeholder">🌱</div>;
  }

  const moveSlider = (dir) => {
    if (!sliderRef.current) return;
    const slider = sliderRef.current;
    isScrollingInternal.current = true;
    slider.scrollBy({
      left: slider.offsetWidth * dir,
      behavior: 'smooth'
    });
    // Allow manual interaction to take over after the smooth scroll completes
    setTimeout(() => { isScrollingInternal.current = false; }, 600);
  };

  return (
    <div className="product-card-img-container" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div 
        className="product-card-slider" 
        ref={sliderRef}
        onScroll={handleScroll}
        style={{ 
          display: 'flex', 
          width: '100%', 
          height: '100%', 
          overflowX: 'auto', 
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {images.map((img, idx) => (
          <img
            key={idx}
            src={getFullImageUrl(img)}
            alt={`${alt} - View ${idx + 1}`}
            style={{ 
              width: '100%', 
              height: '100%', 
              flexShrink: 0, 
              objectFit: 'cover',
              scrollSnapAlign: 'start'
            }}
            loading="lazy"
          />
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button 
            className="slider-arrow prev" 
            onClick={(e) => { e.stopPropagation(); moveSlider(-1); }}
            style={{ 
              position: 'absolute', top: '50%', left: '8px', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.8)', borderRadius: '50%', width: '24px', height: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--gray-200)',
              color: 'var(--gray-800)', zIndex: 10, cursor: 'pointer'
            }}
          >
            ❮
          </button>
          <button 
            className="slider-arrow next" 
            onClick={(e) => { e.stopPropagation(); moveSlider(1); }}
            style={{ 
              position: 'absolute', top: '50%', right: '8px', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.8)', borderRadius: '50%', width: '24px', height: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--gray-200)',
              color: 'var(--gray-800)', zIndex: 10, cursor: 'pointer'
            }}
          >
            ❯
          </button>
          
          <div className="slider-dots" style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px', zIndex: 5 }}>
            {images.map((_, i) => (
              <div 
                key={i} 
                className={`dot ${i === internalIndex ? 'active' : ''}`}
                style={{
                  width: i === internalIndex ? '14px' : '6px',
                  height: '6px',
                  borderRadius: i === internalIndex ? '3px' : '50%',
                  background: i === internalIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  sliderRef.current.scrollTo({ left: sliderRef.current.offsetWidth * i, behavior: 'smooth' });
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductImageSlider;
