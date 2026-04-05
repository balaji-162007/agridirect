import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const Cart = () => {
  const { cartItems, updateCartItem, removeFromCart, cartSubtotal } = useCart();
  const { t } = useLanguage();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const handleQtyChange = (product, newQty) => {
    if (newQty < 1) {
      removeFromCart(product.id || product.product_id);
      return;
    }
    updateCartItem(product.id || product.product_id, newQty);
  };

  const subtotal = cartSubtotal;
  const deliveryCharge = subtotal > 500 ? 0 : 40;
  const total = subtotal + deliveryCharge;

  return (
    <>
      <div className="page-header">
        <div className="container page-header-inner">
          <div className="breadcrumb">
            <Link to="/index.html">Home</Link><span>›</span><span>{t('nav_cart') || 'Cart'}</span>
          </div>
          <h1>{t('cart_title') || 'Your Cart'}</h1>
        </div>
      </div>

      <div className="container section">
        {!isLoggedIn ? (
          <div className="cart-empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div className="cart-empty-icon" style={{ fontSize: '4rem', marginBottom: '16px' }}>🛒</div>
            <p className="fw-600" style={{ fontSize: '1.2rem' }}>Please log in to view your cart</p>
          </div>
        ) : cartItems.length === 0 ? (
          <div className="cart-empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div className="cart-empty-icon" style={{ fontSize: '4rem', marginBottom: '16px' }}>🛒</div>
            <p className="fw-600" style={{ fontSize: '1.2rem' }}>{t('cart_empty') || 'Your cart is empty'}</p>
            <p className="text-muted text-sm mt-8">{t('cart_empty_sub') || 'Looks like you haven\'t added anything yet.'}</p>
            <Link to="/products.html" className="btn btn-primary mt-16">Browse Products</Link>
          </div>
        ) : (
          <div className="cart-page-layout">
            <div className="cart-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {cartItems.map((item) => {
                const imageSrc = item.images && item.images.length > 0 
                  ? (item.images[0].startsWith('http') ? item.images[0] : `https://agridirect-zwew.onrender.com${item.images[0]}`) 
                  : '/images/vegetables.jpg';
                return (
                  <div key={item.id || item.product_id} className="cart-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', border: '1px solid var(--gray-100)', borderRadius: '12px', background: '#fff', position: 'relative' }}>
                    <div className="cart-item-img" style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={imageSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.name} />
                    </div>
                    <div className="cart-item-info" style={{ flex: 1 }}>
                      <div className="cart-item-name" style={{ fontWeight: 600, fontSize: '1.1rem' }}>{item.name}</div>
                      <div className="cart-item-meta" style={{ fontSize: '0.85rem', color: 'var(--gray-500)', margin: '4px 0' }}>🧑‍🌾 {item.farmer_name || 'AgriDirect Farmer'}</div>
                      <div className="cart-item-price" style={{ fontWeight: 600, color: 'var(--green-700)' }}>₹{item.price}<span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', fontWeight: 400 }}>/{item.unit}</span></div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
                        <div className="qty-stepper" style={{ display: 'flex', border: '1px solid var(--gray-200)', borderRadius: '6px', overflow: 'hidden' }}>
                          <button onClick={() => handleQtyChange(item, item.qty - 1)} style={{ padding: '4px 12px', background: 'var(--gray-50)', border: 'none', cursor: 'pointer' }}>−</button>
                          <input type="number" readOnly value={item.qty} style={{ width: '40px', textAlign: 'center', border: 'none', borderLeft: '1px solid var(--gray-200)', borderRight: '1px solid var(--gray-200)' }} />
                          <button onClick={() => handleQtyChange(item, item.qty + 1)} style={{ padding: '4px 12px', background: 'var(--gray-50)', border: 'none', cursor: 'pointer' }}>+</button>
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--gray-900)' }}>₹{(item.price * item.qty).toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <button onClick={() => removeFromCart(item.id || item.product_id)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer' }} title="Remove">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="cart-side-panel">
              <div className="card" style={{ position: 'sticky', top: 'calc(var(--nav-h) + 16px)', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px' }}>
                <div className="card-body" style={{ padding: '24px' }}>
                  <h3 style={{ marginBottom: '18px', fontSize: '1.2rem', fontWeight: 700 }}>Order Summary</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <span>{t('subtotal') || 'Subtotal'}</span>
                    <span style={{ fontWeight: 600 }}>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <span>{t('delivery') || 'Delivery'}</span>
                    <span>{deliveryCharge === 0 ? <span style={{ color: 'var(--green-600)', fontWeight: 600 }}>Free</span> : `₹${deliveryCharge.toFixed(2)}`}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, padding: '16px 0 8px 0', color: 'var(--green-700)' }}>
                    <span>{t('total') || 'Total'}</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                  
                  <button onClick={() => navigate('/checkout.html')} className="btn btn-primary btn-full btn-lg mt-16" style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1rem', marginTop: '24px' }}>
                    Proceed to Checkout
                  </button>
                  <Link to="/products.html" className="btn btn-ghost btn-full mt-8" style={{ width: '100%', padding: '12px', textAlign: 'center', display: 'block', marginTop: '8px' }}>
                    Continue Shopping
                  </Link>
                  <p className="text-xs text-muted text-center mt-12" style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.8rem', color: 'var(--gray-400)' }}>🔒 Secured by Razorpay</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Cart;
