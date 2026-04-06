import React from 'react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import ProductImageSlider from './ProductImageSlider';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (!product) return null;

  return (
    <div className="product-card" onClick={() => navigate(`/product/${product.id}`)} style={{ cursor: 'pointer' }}>
      <div style={{ position: 'relative', height: '220px', overflow: 'hidden', backgroundColor: 'var(--gray-50)' }}>
        <ProductImageSlider images={product.images} alt={product.name} />
        {product.is_organic && <span className="product-badge">🌱 Organic</span>}
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="product-cat text-truncate" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{product.category}</div>
            <h3 className="product-title" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)', margin: '2px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{product.name}</h3>
          </div>
          <div className="product-price" style={{ flexShrink: 0, textAlign: 'right', fontWeight: 800, color: 'var(--green-700)' }}>
            ₹{product.price}<span style={{fontSize:'0.75rem', color:'var(--gray-500)', fontWeight: 400}}>/ {product.unit}</span>
          </div>
        </div>
        <div className="farmer-badge">🧑‍🌾 {product.farmer_name || 'Farmer'}</div>
        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <button className="btn btn-primary btn-full" onClick={(e) => { e.stopPropagation(); addToCart(product, 1); }}>
            {t('add_to_cart') || 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
