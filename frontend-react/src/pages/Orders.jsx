import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, Link } from 'react-router-dom';
import { API } from '../services/api';
import { useToast } from '../components/Toast';

const getFullImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `https://agridirect-zwew.onrender.com${path}`;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'}) : '';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';

const Orders = () => {
  const { user, isLoggedIn } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [trackOrder, setTrackOrder] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [reviewOrderId, setReviewOrderId] = useState(null);
  const [reviewProductId, setReviewProductId] = useState(null);
  const [reviewForm, setReviewForm] = useState({ quality: 5, delivery: 5, overall: 5, comment: '' });

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login.html?redirect=orders');
      return;
    }
    fetchOrders();
  }, [isLoggedIn, navigate]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await API.getMyOrders();
      setOrders(data?.orders || []);
    } catch (e) {
      console.error(e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const openTrackModal = async (id) => {
    try {
      const o = await API.getOrder(id);
      setTrackOrder(o);
    } catch (e) {
      toast(e.message || 'Failed to load order', 'error');
    }
  };

  const handleReviewSubmit = async () => {
    try {
      await API.submitReview({
        product_id: reviewProductId, 
        order_id: reviewOrderId,  
        product_quality: reviewForm.quality,
        delivery_time: reviewForm.delivery,
        overall_service: reviewForm.overall,
        comment: reviewForm.comment
      });
      toast('Review submitted! Thank you ⭐', 'success');
      setReviewOrderId(null);
      setReviewProductId(null);
      fetchOrders();
    } catch (e) {
      toast(e.message || 'Failed to submit review', 'error');
    }
  };

  const isCancelable = (o) => {
    const status = (o.status || '').toLowerCase();
    if (status !== 'placed') return false;
    if (!o.created_at) return false;
    
    const placedDate = new Date(o.created_at);
    if (isNaN(placedDate.getTime())) return false;
    
    const now = new Date();
    const diffMs = now - placedDate;
    const diffMins = diffMs / (1000 * 60);
    
    // Debug info for visibility issues
    console.log(`Order #${o.id} Age: ${diffMins.toFixed(2)} mins`);
    
    // Show if less than 30 mins old (allow 5 min grace for clock skew)
    return diffMins > -5 && diffMins < 30;
  };

  const handleCancelOrder = async (id) => {
    setCancellingOrderId(id);
  };

  const confirmCancellation = async () => {
    if (!cancellingOrderId) return;
    try {
      await API.cancelOrder(cancellingOrderId);
      toast(t('cancel_success'), 'success');
      setCancellingOrderId(null);
      fetchOrders();
    } catch (e) {
      toast(e.message || 'Failed to cancel order', 'error');
    }
  };

  return (
    <div className="orders-page" style={{ padding: '60px 20px', background: 'var(--gray-50)', minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{t('my_orders')}</h1>
            <p style={{ color: 'var(--gray-500)', marginTop: '4px' }}>{t('track_and_manage')}</p>
          </div>
          <Link to="/products.html" className="btn btn-primary">🛒 Continue Shopping</Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px', background: '#fff', borderRadius: '24px', border: '1px solid var(--gray-200)' }}>
            <span className="spinner"></span>
            <p style={{ marginTop: '16px', color: 'var(--gray-500)' }}>Loading your orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', background: '#fff', borderRadius: '24px', border: '1px solid var(--gray-200)' }}>
            <div style={{ fontSize: '4rem', marginBottom: '24px' }}>📦</div>
            <h2 style={{ margin: '0 0 12px 0' }}>{t('no_orders')}</h2>
            <p style={{ color: 'var(--gray-500)', marginBottom: '32px' }}>{t('no_orders_sub')}</p>
            <Link to="/products.html" className="btn btn-primary btn-lg">{t('nav_products')}</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {orders.map(o => (
              <div key={o.id} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '20px', padding: '24px', transition: 'transform 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--gray-100)', paddingBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('order_id')} #{o.id}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '4px' }}>{t('order_placed_at')} {fmtDateTime(o.created_at)}</div>
                    {o.delivery_date && (
                      <div style={{ marginTop: '8px', padding: '6px 12px', background: 'var(--blue-50)', color: 'var(--blue-800)', borderRadius: '6px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid var(--blue-100)' }}>
                        📅 <b>{fmtDate(o.delivery_date)}</b> 
                        <span style={{ opacity: 0.5 }}>|</span> 
                        ⏰ {o.slot?.name} ({o.slot?.start_time} - {o.slot?.end_time})
                      </div>
                    )}
                    {o.status !== 'placed' && (o.status_history || []).find(h => h.status === 'confirmed') && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--green-600)', marginTop: '4px', fontWeight: 600 }}>
                        ✅ Confirmed on {fmtDateTime((o.status_history.find(h => h.status === 'confirmed')).timestamp)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ padding: '6px 16px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', backgroundColor: o.status === 'delivered' ? 'var(--green-100)' : 'var(--amber-100)', color: o.status === 'delivered' ? 'var(--green-800)' : 'var(--amber-800)' }}>
                      {(o.status || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  {(o.items || []).map((i, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '0.95rem', alignItems: 'center', borderBottom: idx < (o.items || []).length - 1 ? '1px dashed var(--gray-100)' : 'none' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                         <div style={{ width: '40px', height: '40px', background: 'var(--gray-100)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🥦</div>
                         <div>
                            <b style={{ fontWeight: 600 }}>{i.product_name}</b> × {i.qty}
                            {o.status === 'delivered' && (
                              <div style={{ marginTop: '4px' }}>
                                <button 
                                  onClick={() => { setReviewOrderId(o.id); setReviewProductId(i.product_id); }}
                                  style={{ background: 'none', border: 'none', color: 'var(--green-600)', fontSize: '0.8rem', fontWeight: 600, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                  ⭐ {t('rate_product')}
                                </button>
                              </div>
                            )}
                         </div>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--gray-900)' }}>₹{(i.price * i.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--gray-100)', paddingTop: '20px', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '24px', fontSize: '0.9rem', color: 'var(--gray-600)' }}>
                    <div>{t('farmer')}: <b style={{ color: 'var(--gray-900)' }}>{o.farmer_name || '—'}</b></div>
                    <div>{t('total_amount')}: <b style={{ color: 'var(--green-700)', fontSize: '1rem' }}>₹{o.total}</b></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                       {o.payment_method === 'cod' ? t('cash_on_delivery') : t('online_payment')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-ghost" onClick={() => openTrackModal(o.id)} style={{ borderRadius: '12px' }}>
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                       {t('track')}
                    </button>
                    {isCancelable(o) && (
                      <button 
                        className="btn btn-ghost" 
                        onClick={() => handleCancelOrder(o.id)} 
                        style={{ 
                          borderRadius: '12px', 
                          color: 'var(--red-600)', 
                          border: '1px solid var(--red-100)', 
                          background: 'var(--red-50)',
                          fontWeight: 700,
                          padding: '8px 16px'
                        }}
                      >
                         🚫 {t('cancel_order')}
                      </button>
                    )}
                    {o.status === 'delivered' && !o.reviewed && (
                      <button className="btn btn-primary" style={{ background: 'var(--amber-500)', borderColor: 'var(--amber-600)', borderRadius: '12px' }} onClick={() => setReviewOrderId(o.id)}>⭐ {t('review')}</button>
                    )}
                    {o.reviewed && <span style={{ color: 'var(--green-600)', fontSize: '0.9rem', fontWeight: 700, background: 'var(--green-50)', padding: '6px 12px', borderRadius: '10px' }}>✅ {t('reviewed')}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* TRACKING MODAL */}
      {trackOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '32px', width: '90%', maxWidth: '500px', padding: '40px', position: 'relative', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <button style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--gray-100)', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--gray-600)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setTrackOrder(null)}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '8px' }}>{t('order_tracking')} #{trackOrder.id}</div>
              <h2 style={{ color: 'var(--green-700)', margin: '0', fontSize: '2rem' }}>{t('status_' + trackOrder.status).toUpperCase()}</h2>
              <div style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginTop: '8px' }}>{t('current_location')}: {t('in_transit')}</div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '15px', top: '10px', bottom: '10px', width: '2px', background: 'var(--gray-200)', zIndex: 0 }}></div>
              {['placed', 'confirmed', 'out_for_delivery', 'delivered'].map((stage, i) => {
                const stagesList = ['placed', 'confirmed', 'out_for_delivery', 'delivered'];
                const currentIndex = stagesList.indexOf(trackOrder.status);
                const isDone = i <= currentIndex;
                const isActive = i === currentIndex;
                const hEntry = (trackOrder.status_history || []).find(h => h.status === stage);

                return (
                  <div key={stage} style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isDone ? 'var(--green-500)' : 'var(--gray-200)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, boxShadow: isDone ? '0 0 15px var(--green-200)' : 'none' }}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <div style={{ opacity: isDone ? 1 : 0.5 }}>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', textTransform: 'capitalize', color: isDone ? 'var(--gray-900)' : 'var(--gray-400)' }}>{t('status_' + stage)}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '4px' }}>
                        {hEntry?.timestamp ? fmtDateTime(hEntry.timestamp) : (stage === 'placed' ? fmtDateTime(trackOrder.created_at) : (isDone ? 'Completed' : 'Expected soon'))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="btn btn-primary btn-full mt-32" onClick={() => setTrackOrder(null)} style={{ padding: '16px', borderRadius: '16px' }}>{t('close_tracking')}</button>
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {reviewOrderId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: '32px', width: '90%', maxWidth: '450px', padding: '40px', position: 'relative', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
             <button style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--gray-100)', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--gray-600)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setReviewOrderId(null); setReviewProductId(null); }}>✕</button>
             <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⭐</div>
                <h2 style={{ margin: 0 }}>{reviewProductId ? t('rate_product') : t('rate_experience')}</h2>
                <p style={{ color: 'var(--gray-500)', marginTop: '8px' }}>{reviewProductId ? t('rate_product_sub') : t('how_was_produce')}</p>
             </div>
             
             {[
               {key: 'quality', label: t('produce_quality'), icon: '🥬'},
               {key: 'delivery', label: t('delivery_speed'), icon: '🚚'},
               {key: 'overall', label: t('overall'), icon: '🤝'}
             ].map(({key, label, icon}) => (
               <div key={key} style={{ marginBottom: '24px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--gray-700)' }}>{icon} {label}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--green-600)', fontWeight: 700 }}>{reviewForm[key]} / 5</div>
                 </div>
                 <div style={{ display: 'flex', gap: '8px', fontSize: '2rem', cursor: 'pointer', justifyContent: 'center' }}>
                   {[1, 2, 3, 4, 5].map(star => (
                     <span key={star} onClick={() => setReviewForm({ ...reviewForm, [key]: star })} style={{ color: star <= reviewForm[key] ? 'var(--amber-400)' : 'var(--gray-200)', transition: 'transform 0.1s' }} onMouseEnter={(e) => e.target.style.transform='scale(1.2)'} onMouseLeave={(e) => e.target.style.transform='scale(1)'}>★</span>
                   ))}
                 </div>
               </div>
             ))}

             <div style={{ marginBottom: '32px' }}>
               <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '12px' }}>{t('additional_feedback')}</label>
               <textarea value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--gray-200)', resize: 'none', minHeight: '100px', fontSize: '0.95rem', background: 'var(--gray-50)' }} placeholder={t('comment_placeholder')}></textarea>
             </div>

             <button className="btn btn-primary btn-full btn-lg" onClick={handleReviewSubmit} style={{ padding: '18px', borderRadius: '16px', fontSize: '1.1rem' }}>{t('submit_review')}</button>
          </div>
        </div>
      )}

      {/* CANCEL CONFIRMATION MODAL */}
      {cancellingOrderId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#fff', borderRadius: '32px', width: '90%', maxWidth: '400px', padding: '40px', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', transform: 'translateY(0)', transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🛑</div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--gray-900)' }}>{t('cancel_order')}</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '1rem', lineHeight: 1.6, marginBottom: '32px' }}>{t('cancel_confirm')}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="btn btn-primary" 
                onClick={confirmCancellation}
                style={{ background: 'var(--red-600)', borderColor: 'var(--red-700)', padding: '16px', borderRadius: '16px', fontSize: '1rem', fontWeight: 700 }}
              >
                {t('confirm')} & {t('cancel_order')}
              </button>
              <button 
                className="btn btn-ghost" 
                onClick={() => setCancellingOrderId(null)}
                style={{ padding: '16px', borderRadius: '16px', fontSize: '1rem', fontWeight: 600, color: 'var(--gray-600)' }}
              >
                {t('back')} / Keep Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
