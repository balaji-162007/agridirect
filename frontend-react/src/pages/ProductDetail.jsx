import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { API, getFullImageUrl } from '../services/api';
import ProductImageSlider from '../components/ProductImageSlider';

const ProductDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { t } = useLanguage();
  const { user, isLoggedIn } = useAuth();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);

  // Review Form state
  const [revForm, setRevForm] = useState({ quality: 5, delivery: 5, service: 5, comment: '' });

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const [prodData, revData] = await Promise.all([
          API.getProduct(id),
          API.getProductReviews(id)
        ]);
        setProduct(prodData);
        setReviews(revData?.reviews || []);
        setTotalReviews(revData?.total || 0);
      } catch (err) {
        setError("Product not found or failed to load.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return <div className="container" style={{ paddingTop: '40px', textAlign: 'center' }}>Loading product details...</div>;
  }

  if (error || !product) {
    return (
      <div className="empty-state container" style={{ marginTop: '40px' }}>
        <div className="empty-icon">😕</div>
        <h3>{error}</h3>
        <Link to="/products.html" className="btn btn-primary mt-16">Browse Products</Link>
      </div>
    );
  }

  // Pre-process product info
  const name = product.name;
  const imgs = product.images || [];
  const hasMP = !!product.market_price;
  const diff = hasMP ? (((product.price - product.market_price) / product.market_price) * 100).toFixed(1) : 0;

  // Helpers
  const handlePrevImage = () => {
    setActiveImage((prev) => (prev > 0 ? prev - 1 : imgs.length - 1));
  };

  const handleNextImage = () => {
    setActiveImage((prev) => (prev < imgs.length - 1 ? prev + 1 : 0));
  };


  const handleQtyChange = (delta) => {
    let newQty = qty + delta;
    if (newQty < 1) newQty = 1;
    if (newQty > product.quantity) newQty = product.quantity;
    setQty(newQty);
  };

  const handleAddToCart = () => {
    addToCart(product, qty);
  };

  const submitReview = async () => {
    try {
      if (!revForm.quality || !revForm.delivery || !revForm.service) {
        alert("Please provide all ratings");
        return;
      }
      await API.submitReview({
        product_id: parseInt(id),
        product_quality: revForm.quality,
        delivery_time: revForm.delivery,
        overall_service: revForm.service,
        comment: revForm.comment
      });
      alert('Review submitted!');
      const revData = await API.getProductReviews(id);
      setReviews(revData?.reviews || []);
      setTotalReviews(revData?.total || 0);
      setRevForm({ ...revForm, comment: '' });
    } catch (e) {
      alert(e.message || 'Failed to submit review');
    }
  };

  const renderStars = (n, max = 5) => {
    return Array.from({length: max}, (_, i) => (
      <span key={i} style={{ color: i < Math.round(n) ? 'var(--amber-500)' : 'var(--gray-200)', fontSize: '1.2rem' }}>★</span>
    ));
  };

  const avgReview = reviews.length ? (reviews.reduce((s, r) => s + r.overall_service, 0) / reviews.length).toFixed(1) : null;

  return (
    <div className="product-detail-container container" style={{ paddingTop: '20px' }}>
      <div className="breadcrumb mb-24" style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>
        <Link to="/index.html">Home</Link><span style={{ margin: '0 8px' }}>›</span>
        <Link to="/products.html">Products</Link><span style={{ margin: '0 8px' }}>›</span>
        <span className="text-muted">{name}</span>
      </div>

      <div className="product-detail-grid">
        <div className="detail-img-col">
          <div 
            className="detail-main-img" 
            style={{ position: 'relative' }}
          >
            <ProductImageSlider 
              images={imgs} 
              alt={name} 
              activeIndex={activeImage} 
              autoCycle={false} 
              onChange={setActiveImage}
            />
          </div>
          {imgs.length > 1 && (
            <div className="detail-thumbs" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {imgs.map((img, i) => (
                <div 
                  key={i} 
                  className={`detail-thumb ${i === activeImage ? 'active' : ''}`} 
                  onClick={() => setActiveImage(i)}
                  style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: i === activeImage ? '2px solid var(--green-600)' : '2px solid transparent' }}
                >
                  <img src={getFullImageUrl(img)} alt={`Thumb ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info-col">
          <div className="detail-category-caps" style={{ textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 600, color: 'var(--green-600)', letterSpacing: '1px' }}>
            {product.category}
          </div>
          <h1 className="detail-title-bold" style={{ fontSize: '2rem', marginBottom: '16px' }}>{name}</h1>
          
          <div className="detail-badges-row" style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {product.is_organic && <span className="badge-rounded badge-organic" style={{ padding: '4px 12px', background: 'var(--green-50)', color: 'var(--green-700)', borderRadius: '20px', fontSize: '0.85rem' }}>🌱 {t('organic') || 'Organic'}</span>}
            <span className="badge-rounded badge-instock" style={{ padding: '4px 12px', background: product.quantity > 0 ? '#e0f2fe' : '#fee2e2', color: product.quantity > 0 ? '#0369a1' : '#b91c1c', borderRadius: '20px', fontSize: '0.85rem' }}>
              {product.quantity > 0 ? t('in_stock') || 'In Stock' : t('out_of_stock') || 'Out of Stock'}
            </span>
          </div>

          <div className="detail-price-box-new" style={{ padding: '24px', background: 'var(--gray-50)', borderRadius: '16px', marginBottom: '24px' }}>
            <div className="price-main-row" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--gray-900)' }}>
              <span className="currency">₹</span><span className="amount">{product.price}</span>
              <span className="unit" style={{ fontSize: '1rem', color: 'var(--gray-500)', fontWeight: 400 }}> /{product.category === 'Dairy' ? 'liter' : product.unit}</span>
            </div>
            {hasMP && (
              <div className="market-info-row" style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                <span className="market-price-text" style={{ color: 'var(--gray-500)' }}>Market: ₹{product.market_price}/kg</span>
                <span className={`price-diff ${diff < 0 ? 'down' : 'up'}`} style={{ marginLeft: '12px', color: diff < 0 ? 'var(--green-600)' : 'var(--red-500)', fontWeight: 600 }}>
                  {diff < 0 ? `▼ ${Math.abs(diff)}% below market` : `▲ ${diff}% above market`}
                </span>
              </div>
            )}
          </div>

          <div className="qty-section" style={{ marginBottom: '24px' }}>
            <div className="qty-label" style={{ fontWeight: 600, marginBottom: '8px' }}>Available Quantity</div>
            <div className="qty-row-new" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="qty-stepper" style={{ display: 'flex', border: '1px solid var(--gray-200)', borderRadius: '8px', overflow: 'hidden' }}>
                <button onClick={() => handleQtyChange(-1)} style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>−</button>
                <input type="number" value={qty} readOnly style={{ width: '50px', textAlign: 'center', border: 'none', borderLeft: '1px solid var(--gray-200)', borderRight: '1px solid var(--gray-200)' }} />
                <button onClick={() => handleQtyChange(1)} style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>+</button>
              </div>
              <div className="qty-available-text" style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                {product.quantity} {product.unit} {t('available') || 'available'}
              </div>
            </div>
          </div>

          <div className="detail-actions-row" style={{ marginBottom: '32px' }}>
            <button className="btn btn-primary btn-large" onClick={handleAddToCart} disabled={product.quantity <= 0} style={{ width: '100%', padding: '16px', fontSize: '1.1rem', borderRadius: '12px' }}>
              {t('add_to_cart') || 'Add to Cart'}
            </button>
          </div>

          <div className="specs-grid-new" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
            <div className="spec-box" style={{ background: 'var(--gray-50)', padding: '16px', borderRadius: '12px' }}>
              <div className="label" style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, marginBottom: '4px' }}>HARVESTED / PRODUCED</div>
              <div className="value" style={{ fontWeight: 600 }}>{product.harvest_date ? new Date(product.harvest_date).toLocaleDateString() : 'N/A'}</div>
            </div>
            <div className="spec-box" style={{ background: 'var(--gray-50)', padding: '16px', borderRadius: '12px' }}>
              <div className="label" style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, marginBottom: '4px' }}>CATEGORY</div>
              <div className="value" style={{ fontWeight: 600, textTransform: 'capitalize' }}>{product.category}</div>
            </div>
            <div className="spec-box" style={{ background: 'var(--gray-50)', padding: '16px', borderRadius: '12px' }}>
              <div className="label" style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, marginBottom: '4px' }}>PRODUCT TYPE</div>
              <div className="value" style={{ fontWeight: 600, textTransform: 'capitalize' }}>{product.product_type}</div>
            </div>
            <div className="spec-box" style={{ background: 'var(--gray-50)', padding: '16px', borderRadius: '12px' }}>
              <div className="label" style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, marginBottom: '4px' }}>FARMER</div>
              <div className="value" style={{ fontWeight: 600 }}>{product.farmer_name || 'AgriDirect Farmer'}</div>
            </div>
          </div>

          {product.description && (
            <div style={{ marginTop: '8px' }}>
              <div className="qty-label mb-8" style={{ fontWeight: 600, marginBottom: '8px' }}>{t('description') || 'Description'}</div>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--gray-600)' }}>{product.description}</p>
            </div>
          )}
        </div>
      </div>

      <div id="reviewsSection" style={{ marginTop: '64px', borderTop: '1px solid var(--gray-100)', paddingTop: '48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3>Customer Reviews</h3>
          {avgReview && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex' }}>{renderStars(avgReview)}</div>
              <span className="fw-700" style={{ fontSize: '1.2rem', color: 'var(--gray-900)' }}>{avgReview}</span>
              <span className="text-muted text-sm" style={{ color: 'var(--gray-400)' }}>({totalReviews} reviews)</span>
            </div>
          )}
        </div>
        
        {reviews.length > 0 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {reviews.map(r => (
              <div key={r.id} className="review-item" style={{ padding: '16px', border: '1px solid var(--gray-100)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div className="fw-600 text-sm">{r.customer_name}</div>
                  <div className="review-date" style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', width: '60px' }}>Quality:</span>
                    <div style={{ display: 'flex' }}>{renderStars(r.product_quality)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', width: '60px' }}>Delivery:</span>
                    <div style={{ display: 'flex' }}>{renderStars(r.delivery_time)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', width: '60px' }}>Service:</span>
                    <div style={{ display: 'flex' }}>{renderStars(r.overall_service)}</div>
                  </div>
                </div>
                {r.comment && <p className="review-text" style={{ fontSize: '0.9rem', marginTop: '8px' }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted text-sm mb-24">No reviews yet. Be the first to review!</p>
        )}

        {isLoggedIn && user?.role === 'customer' ? (
          <div className="card mt-32" style={{ background: 'var(--gray-50)', padding: '24px', borderRadius: '16px', marginTop: '32px' }}>
            <h4 className="mb-16">Write a Review</h4>
            <div className="form-grid mb-16" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              {[
                { label: 'Quality', key: 'quality' },
                { label: 'Delivery', key: 'delivery' },
                { label: 'Overall Service', key: 'service' }
              ].map((field) => (
                <div key={field.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>{field.label}</label>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '1.8rem', cursor: 'pointer' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span 
                        key={star} 
                        onClick={() => setRevForm({ ...revForm, [field.key]: star })}
                        style={{ color: star <= revForm[field.key] ? 'var(--amber-400)' : 'var(--gray-200)', transition: 'transform 0.1s' }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="form-group mb-16">
              <label className="form-label">Your Comment</label>
              <textarea className="form-input" rows="3" value={revForm.comment} onChange={(e) => setRevForm({...revForm, comment: e.target.value})} placeholder="Tell others about your experience..." style={{ width: '100%', padding: '8px' }}></textarea>
            </div>
            <button className="btn btn-primary mt-16" onClick={submitReview}>Submit Review</button>
          </div>
        ) : (
          !isLoggedIn && (
            <div className="mt-32 text-center p-24 border-dashed rounded-xl" style={{ border: '2px dashed var(--gray-200)', padding: '32px', textAlign: 'center', marginTop: '32px', borderRadius: '16px' }}>
              <p className="text-muted text-sm">Please login as a customer to write a review.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
