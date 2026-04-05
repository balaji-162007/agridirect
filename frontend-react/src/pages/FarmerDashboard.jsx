import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API, BASE_URL } from '../services/api';
import ProductImageSlider from '../components/ProductImageSlider';
import { useToast } from '../components/Toast';

const getFullImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `https://agridirect-zwew.onrender.com${path}`;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'}) : '';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
const renderStars = (n, max = 5) => Array.from({length: max}, (_, i) => <span key={i} style={{ color: i < Math.round(n) ? 'var(--amber-500)' : 'var(--gray-200)' }}>★</span>);

const FarmerDashboard = () => {
  const { user, login, isLoggedIn, openAuthModal } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState(searchParams.get('section') || 'dashboard');

  // Sync tab when URL ?section= param changes (e.g. from hamburger menu links)
  useEffect(() => {
    const section = searchParams.get('section');
    if (section) setActiveTab(section);
  }, [searchParams]);

  // Stats State
  const [stats, setStats] = useState({ products: 0, completed_orders: 0, revenue: 0, avg_rating: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Dash Summaries
  const [marketSummary, setMarketSummary] = useState([]);
  const [farmersSummary, setFarmersSummary] = useState([]);
  const [isCommunityLoading, setIsCommunityLoading] = useState(false);
  const [marketQuery, setMarketQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [districts, setDistricts] = useState([]);

  // Products State
  const [products, setProducts] = useState([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Product Form
  const [productForm, setProductForm] = useState({
    name: '', name_ta: '', description: '', category: 'vegetables', product_type: 'organic', price: '', unit: 'kg'
  });
  const [productImages, setProductImages] = useState(null);
  const [isProductSaving, setIsProductSaving] = useState(false);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifLoading, setIsNotifLoading] = useState(false);

  // Reviews State
  const [reviews, setReviews] = useState([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);

  // Profile Form state
  const [profileData, setProfileData] = useState({ 
    name: '', phone: '', location: '', farm_name: '', bio: '',
    lat: '', lng: '', max_delivery_dist: '', max_carrying_capacity: ''
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [locFeedback, setLocFeedback] = useState('');
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);

  useEffect(() => {
    const section = searchParams.get('section');
    const validSections = ['dashboard', 'products', 'orders', 'notifications', 'reviews', 'support', 'profile'];
    if (section && validSections.includes(section)) {
      setActiveTab(section);
    }
  }, [searchParams]);

  // Auth Redirect Logic
  useEffect(() => {
    if (!isLoggedIn) { 
      navigate('/index.html'); 
      setTimeout(() => openAuthModal('login', 'farmer'), 100);
      return; 
    }
    if (user?.role === 'customer') {
      navigate('/customer-dashboard.html'); 
    }
  }, [isLoggedIn, user?.role, navigate]);

  // Data Loading Logic
  useEffect(() => {
    if (!isLoggedIn || user?.role !== 'farmer') return;
    
    refreshData();
    
    if (activeTab === 'profile' && user) {
      setProfileData({ 
        name: user.name || '', 
        phone: user.phone || '', 
        location: user.location || '', 
        farm_name: user.farm_name || '', 
        bio: user.bio || '',
        lat: user.lat || '',
        lng: user.lng || '',
        max_delivery_dist: user.max_delivery_dist || '',
        max_carrying_capacity: user.max_carrying_capacity || ''
      });
    }
  }, [activeTab, isLoggedIn, user?.id]);

  const refreshData = () => {
    if (activeTab === 'dashboard') {
      fetchStats();
      fetchOrders(); 
      fetchMarketSummary();
      fetchFarmersSummary();
    }
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'notifications') fetchNotifications();
    if (activeTab === 'reviews') fetchReviews();
    if (activeTab === 'farmers') fetchFarmersFull();
    if (activeTab === 'market') fetchMarketPrices();
  };

  const fetchStats = async () => {
    setIsStatsLoading(true);
    try { 
      const data = await API.getFarmerStats(); 
      setStats(data || { products: 0, completed_orders: 0, revenue: 0, avg_rating: 0 }); 
    } catch (e) { console.error(e); } finally { setIsStatsLoading(false); }
  };

  const fetchMarketSummary = async () => {
    try { const data = await API.getMarketPrices({ limit: 5 }); setMarketSummary(data?.prices || []); } catch (e) { console.error(e); }
  };

  const fetchMarketPrices = async (q = marketQuery, d = districtFilter) => {
    setIsCommunityLoading(true);
    try { 
      // The backend gets everything by default if district_id is not provided
      const data = await API.getMarketPrices(); 
      let prices = data?.prices || [];
      if (q) {
        prices = prices.filter(p => (p.name || '').toLowerCase().includes(q.toLowerCase()) || (p.name_ta || '').includes(q));
      }
      if (d) {
        prices = prices.filter(p => p.district_name === d);
      }
      setMarketSummary(prices);
      const dists = await API.getMarketDistricts();
      setDistricts(dists?.districts || []);
    } catch (e) { console.error(e); } finally { setIsCommunityLoading(false); }
  };

  const fetchFarmersSummary = async () => {
    try { const data = await API.getFarmers({ limit: 6 }); setFarmersSummary(data?.farmers || []); } catch (e) { console.error(e); }
  };

  const fetchFarmersFull = async () => {
    setIsCommunityLoading(true);
    try { 
      const data = await API.getFarmers({ limit: 100 }); 
      setFarmersSummary(data?.farmers || []); 
    } catch (e) { console.error(e); } finally { setIsCommunityLoading(false); }
  };

  const fetchNotifications = async () => {
    setIsNotifLoading(true);
    try {
      const data = await API.getNotifications();
      const notifs = data?.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (e) { console.error(e); } finally { setIsNotifLoading(false); }
  };

  const fetchProducts = async () => {
    setIsProductsLoading(true);
    try { const data = await API.getFarmerProducts(); setProducts(data?.products || []); } catch (e) { console.error(e); } finally { setIsProductsLoading(false); }
  };

  const fetchOrders = async () => {
    setIsOrdersLoading(true);
    try { const data = await API.getFarmerOrders(); setOrders(data?.orders || []); } catch (e) { console.error(e); } finally { setIsOrdersLoading(false); }
  };

  const fetchReviews = async () => {
    setIsReviewsLoading(true);
    try { const data = await API.getFarmerReviews(); setReviews(data?.reviews || []); } catch (e) { console.error(e); } finally { setIsReviewsLoading(false); }
  };

  // Profile Handlers
  const handleProfileChange = (e) => setProfileData({ ...profileData, [e.target.name]: e.target.value });
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err) {
      console.error("Camera access error:", err);
      toast('Could not access camera. Please check permissions.', 'error');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Trigger flash animation
      const flash = document.getElementById('shutterFlash');
      if (flash) {
        flash.classList.remove('active');
        void flash.offsetWidth; 
        flash.classList.add('active');
      }
      
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], "captured-photo.jpg", { type: "image/jpeg" });
        setProfilePhoto(file);
        setPhotoPreview(URL.createObjectURL(blob));
        setTimeout(() => stopCamera(), 300);
      }, 'image/jpeg', 0.9);
    }
  };

  const saveProfile = async () => {
    setIsProfileSaving(true);
    const fd = new FormData();
    Object.keys(profileData).forEach(k => {
      if (profileData[k] !== null && profileData[k] !== undefined) {
        fd.append(k, profileData[k]);
      }
    });
    if (profilePhoto) fd.append('profile_photo', profilePhoto);
    try {
      const res = await API.updateFarmerProfile(fd);
      if (res?.user) { 
        login({ ...user, ...res.user }, localStorage.getItem('token')); 
        toast('Profile saved successfully!', 'success');
      }
    } catch (e) { toast(e.message || 'Failed to save', 'error'); } finally { setIsProfileSaving(false); }
  };

  const getFarmerLocation = () => {
    if (!navigator.geolocation) { toast('Geolocation not supported by your browser', 'error'); return; }
    setLocFeedback('📍 Fetching your location...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          if (data && data.display_name) {
            setProfileData(prev => ({ ...prev, location: data.display_name }));
            setLocFeedback('✅ Location updated!');
            setTimeout(() => setLocFeedback(''), 3000);
          } else {
            setLocFeedback('❌ Could not determine address');
          }
        } catch (e) {
          setLocFeedback('❌ Address fetch failed. Check your connection.');
        }
      },
      (err) => {
        if (err.code === 1) setLocFeedback('❌ Permission denied — please allow location access');
        else setLocFeedback('❌ Could not get location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Stores raw GPS coordinates into lat/lng fields for delivery distance calculations
  const getFarmLocation = () => {
    if (!navigator.geolocation) {
      toast('Geolocation is not supported by your browser', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProfileData(prev => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6)
        }));
        toast('Farm GPS coordinates saved!', 'success');
      },
      (err) => {
        console.error("GPS Error:", err);
        toast('Could not get location. Please ensure GPS is enabled.', 'error');
      }
    );
  };

  // Product CRUD
  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', name_ta: '', description: '', category: 'vegetables', product_type: 'organic', price: '', unit: 'kg' });
    setProductImages(null);
    setShowProductModal(true);
  };

  const openEditProduct = (p) => {
    setEditingProduct(p);
    setProductForm({ name: p.name, name_ta: p.name_ta || '', description: p.description || '', category: p.category, product_type: p.product_type, price: p.price, unit: p.unit || 'kg' });
    setProductImages(null);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try { await API.deleteProduct(id); toast('Product deleted successfully', 'success'); fetchProducts(); } catch (e) { toast('Failed to delete product', 'error'); }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setIsProductSaving(true);
    try {
      const fd = new FormData();
      Object.keys(productForm).forEach(k => fd.append(k, productForm[k]));
      if (productImages && productImages.length > 0) {
        for (let i = 0; i < productImages.length; i++) fd.append('images', productImages[i]);
      }
      if (editingProduct) await API.updateProduct(editingProduct.id, fd);
      else await API.createProduct(fd);
      
      toast(editingProduct ? 'Product updated!' : 'Product added!', 'success');
      setShowProductModal(false);
      fetchProducts();
    } catch (err) {
      toast(err.message || 'Failed to save product', 'error');
    } finally {
      setIsProductSaving(false);
    }
  };

  // Order Status Tracking
  const updateOrderStatus = async (id, status) => {
    try {
      await API.updateOrderStatus(id, status);
      fetchOrders();
    } catch (err) { toast('Could not update order status', 'error'); }
  };

  // Attach camera stream
  useEffect(() => {
    if (showCamera && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCamera, cameraStream]);

  if (!user) return null;

  return (
    <>
      <div className="container" style={{ padding: '40px 20px', display: 'flex', gap: '32px', minHeight: '600px', flexWrap: 'wrap', justifyContent: 'center' }}>
        
        {/* DESKTOP SIDEBAR (hidden on mobile) */}
        <aside className="dash-sidebar js-hide-mobile" style={{ width: '280px', flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '32px 20px', textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 16px', background: user.profile_photo ? 'transparent' : 'var(--green-100)', color: 'var(--green-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 600, overflow: 'hidden', border: '2px solid var(--green-50)' }}>
              {user.profile_photo ? <img src={getFullImageUrl(user.profile_photo) || undefined} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.name || 'F')[0].toUpperCase()}
            </div>
            <h3 style={{ margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', fontSize: '1.2rem' }}>{user.name || 'Farmer'}</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '4px' }}>🧑‍🌾 {t('i_am_farmer')}</div>
            {user.location && <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '4px' }}>📍 {user.location}</div>}
          </div>

          <nav style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <button className={`dash-nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              {t('dashboard')}
            </button>
            <button className={`dash-nav-link ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              {t('nav_orders')}
            </button>
            <button className={`dash-nav-link ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
              {t('my_products')}
            </button>
            <button className={`dash-nav-link ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                {unreadCount > 0 && <span className="notif-badge-dot" />}
              </div>
              {t('notifications')}
            </button>
            <button className={`dash-nav-link ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              {t('nav_reviews')}
            </button>
            
            <div style={{ padding: '8px 20px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px' }}>Market & Community</div>
            <button className={`dash-nav-link ${activeTab === 'farmers' ? 'active' : ''}`} onClick={() => setActiveTab('farmers')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {t('nav_farmers')}
            </button>
            <button className={`dash-nav-link ${activeTab === 'market' ? 'active' : ''}`} onClick={() => setActiveTab('market')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              {t('nav_market')}
            </button>
            <button className={`dash-nav-link ${activeTab === 'support' ? 'active' : ''}`} onClick={() => setActiveTab('support')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {t('farmer_support')}
            </button>

            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--gray-100)', paddingTop: '8px' }}>
              <button className={`dash-nav-link ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {t('nav_profile')}
              </button>
              <button className="dash-nav-link text-red" onClick={() => { if(window.confirm('Logout?')) navigate('/index.html'); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                {t('nav_logout')}
              </button>
            </div>
          </nav>
        </aside>

        {/* MAIN DISPLAY */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{t('dashboard')}</h2>
                 <div style={{ fontSize: '0.9rem', color: 'var(--gray-500)' }}>{fmtDateTime(new Date())}</div>
               </div>

               {isStatsLoading ? <div>Loading stats...</div> : (
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                   <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                       <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--green-50)', color: 'var(--green-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🌾</div>
                       <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--green-600)', background: 'var(--green-50)', padding: '2px 8px', borderRadius: '50px' }}>LIVE</div>
                     </div>
                     <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: 600 }}>{t('my_products')}</div>
                     <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--gray-800)', marginTop: '4px' }}>{stats.products}</div>
                   </div>
                   <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                       <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--blue-50)', color: 'var(--blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🛒</div>
                     </div>
                     <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: 600 }}>{t('completed_orders')}</div>
                     <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--gray-800)', marginTop: '4px' }}>{stats.completed_orders}</div>
                   </div>
                   <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                       <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--amber-50)', color: 'var(--amber-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>💰</div>
                     </div>
                     <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: 600 }}>{t('revenue')}</div>
                     <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--gray-800)', marginTop: '4px' }}>₹{(stats.revenue || 0).toLocaleString()}</div>
                   </div>
                   <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                       <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--red-50)', color: 'var(--red-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>⭐</div>
                     </div>
                     <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: 600 }}>{t('avg_rating')}</div>
                     <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--gray-800)', marginTop: '4px' }}>{stats.avg_rating ? stats.avg_rating.toFixed(1) : '—'}</div>
                   </div>
                 </div>
               )}

               <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
                 <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <h4 style={{ margin: 0 }}>{t('recent_orders')}</h4>
                   <button className="btn btn-ghost btn-xs" onClick={() => setActiveTab('orders')}>{t('view_all')}</button>
                 </div>
                 <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                          <th style={{ padding: '12px 24px', fontSize: '0.8rem', color: 'var(--gray-500)' }}>{t('order_id')}</th>
                          <th style={{ padding: '12px 24px', fontSize: '0.8rem', color: 'var(--gray-500)' }}>{t('customer')}</th>
                          <th style={{ padding: '12px 24px', fontSize: '0.8rem', color: 'var(--gray-500)' }}>{t('amount')}</th>
                          <th style={{ padding: '12px 24px', fontSize: '0.8rem', color: 'var(--gray-500)' }}>{t('delivery')}</th>
                          <th style={{ padding: '12px 24px', fontSize: '0.8rem', color: 'var(--gray-500)' }}>{t('order_status')}</th>
                          <th style={{ padding: '12px 24px', fontSize: '0.8rem', color: 'var(--gray-500)' }}>{t('action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isOrdersLoading ? <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-400)' }}>Loading...</td></tr> : orders.length === 0 ? <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-400)' }}>No recent orders</td></tr> : orders.slice(0, 5).map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                            <td style={{ padding: '16px 24px', fontWeight: 600 }}>#{o.id}</td>
                            <td style={{ padding: '16px 24px' }}>{o.customer_name}</td>
                            <td style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--green-700)' }}>₹{o.total}</td>
                            <td style={{ padding: '16px 24px' }}>
                              {o.delivery_date ? (
                                <div style={{ fontSize: '0.85rem' }}>
                                  <div style={{ fontWeight: 600 }}>{fmtDate(o.delivery_date)}</div>
                                  <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>{o.slot?.name} ({o.slot?.start_time})</div>
                                </div>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '16px 24px' }}>
                              <span style={{ padding: '4px 10px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 700, background: o.status === 'delivered' ? 'var(--green-50)' : 'var(--amber-50)', color: o.status === 'delivered' ? 'var(--green-700)' : 'var(--amber-700)', textTransform: 'uppercase' }}>{o.status}</span>
                            </td>
                            <td style={{ padding: '16px 24px' }}>
                              <button className="btn btn-ghost btn-xs" onClick={() => setActiveTab('orders')}>{t('details')}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
               </div>

               {/* HIDDEN: Market & Community Summaries as requested */}
            </div>
          )}

          {activeTab === 'products' && (
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{t('my_products')}</h2>
                <button className="btn btn-primary" onClick={openAddProduct}>{t('add_new_product')}</button>
              </div>
              <div style={{ padding: '24px' }}>
                {isProductsLoading ? <div>Loading...</div> : products.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-500)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🌾</div>
                    <h4>{t('no_products_found')}</h4>
                    <p>{t('start_selling_msg')}</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                    {products.map(p => (
                      <div key={p.id} style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ height: '140px', background: 'var(--gray-100)', position: 'relative', overflow: 'hidden' }}>
                          <ProductImageSlider images={p.images} alt={p.name} />
                        </div>
                        <div style={{ padding: '16px', flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', textTransform: 'capitalize' }}>{p.category} • {p.product_type}</div>
                          <div style={{ fontWeight: 700, marginTop: '8px', color: 'var(--green-700)' }}>₹{p.price} / {p.unit}</div>
                        </div>
                        <div style={{ borderTop: '1px solid var(--gray-100)', display: 'flex' }}>
                          <button style={{ flex: 1, padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--green-600)', borderRight: '1px solid var(--gray-100)' }} onClick={() => openEditProduct(p)}>{t('edit')}</button>
                          <button style={{ flex: 1, padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--red-500)' }} onClick={() => handleDeleteProduct(p.id)}>{t('delete')}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--gray-100)' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{t('orders_received')}</h2>
              </div>
              <div style={{ padding: '24px' }}>
                {isOrdersLoading ? <div>Loading...</div> : orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-500)' }}>No orders yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {orders.map(o => (
                      <div key={o.id} style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>Order #{o.id}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{fmtDateTime(o.created_at)}</div>
                            {o.delivery_date && (
                              <div style={{ marginTop: '8px', padding: '6px 12px', background: 'var(--blue-50)', color: 'var(--blue-800)', borderRadius: '6px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid var(--blue-100)' }}>
                                📅 <b>{fmtDate(o.delivery_date)}</b> 
                                <span style={{ opacity: 0.5 }}>|</span> 
                                ⏰ {o.slot?.name} ({o.slot?.start_time} - {o.slot?.end_time})
                              </div>
                            )}
                          </div>
                          {o.status === 'delivered' || o.status === 'cancelled' ? (
                            <span style={{ padding: '6px 14px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 700, background: o.status === 'delivered' ? 'var(--green-50)' : 'var(--red-50)', color: o.status === 'delivered' ? 'var(--green-700)' : 'var(--red-700)', textTransform: 'uppercase' }}>
                              {t('status_' + o.status)}
                            </span>
                          ) : (
                            <select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value)} style={{ padding: '6px 14px', borderRadius: '50px', border: '1px solid var(--gray-300)', background: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
                              <option value="placed">{t('status_placed')}</option>
                              <option value="confirmed">{t('status_confirmed')}</option>
                              <option value="out_for_delivery">{t('status_out_for_delivery')}</option>
                              <option value="delivered">{t('status_delivered')}</option>
                              <option value="cancelled">{t('status_cancelled')}</option>
                            </select>
                          )}
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                          {(o.items || []).map((i, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem' }}>
                              <span>{i.product_name} × {i.qty}</span>
                              <span style={{ fontWeight: 600 }}>₹{(i.price * i.qty).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginBottom: '16px', background: 'var(--gray-50)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: '4px' }}>📍 {t('delivery_addr')}</div>
                          <div style={{ color: 'var(--gray-600)' }}>
                            {o.delivery_address?.line1}, {o.delivery_address?.line2 ? o.delivery_address.line2 + ', ' : ''} 
                            {o.delivery_address?.city}, {o.delivery_address?.state} - {o.delivery_address?.pincode}
                          </div>
                          {o.delivery_address?.latitude && o.delivery_address?.longitude && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ color: 'var(--blue-600)', fontFamily: 'monospace' }}>
                                {o.delivery_address.latitude.toFixed(6)}, {o.delivery_address.longitude.toFixed(6)}
                              </div>
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${o.delivery_address.latitude},${o.delivery_address.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-xs"
                                style={{ height: 'auto', padding: '4px 10px', fontSize: '0.7rem' }}
                              >
                                🗺️ {t('view_on_maps')}
                              </a>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--gray-100)', paddingTop: '16px', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--gray-600)' }}>{t('customer')}: <b>{o.customer_name || '—'}</b> | 📱 {o.delivery_address?.phone || o.customer_phone || '—'}</span>
                          <span style={{ fontWeight: 700, color: 'var(--green-700)' }}>{t('total_amount')}: ₹{o.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{t('notifications')}</h2>
                {notifications.length > 0 && <button className="btn btn-ghost btn-xs" onClick={() => API.markAllNotificationsRead().then(fetchNotifications)}>{t('mark_all_read')}</button>}
              </div>
              <div style={{ padding: '24px' }}>
                {isNotifLoading ? <div>{t('loading')}</div> : notifications.length === 0 ? <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-500)' }}>{t('no_notifications')}</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {notifications.map((n, idx) => (
                      <div key={idx} 
                        style={{ 
                          padding: '16px', 
                          borderRadius: '12px', 
                          background: n.is_read ? 'transparent' : 'var(--green-50)', 
                          border: '1px solid', 
                          borderColor: n.is_read ? 'var(--gray-100)' : 'var(--green-100)', 
                          display: 'flex', 
                          gap: '16px', 
                          cursor: 'pointer' 
                        }} 
                        onClick={() => {
                          if (!n.is_read) API.markNotificationRead(n.id).then(fetchNotifications);
                          if (n.type === 'order') {
                            setActiveTab('orders');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                      >
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: n.is_read ? 'var(--gray-100)' : 'var(--green-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                          {n.type === 'order' ? '📦' : n.type === 'alert' ? '⚠️' : '🔔'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{n.title}</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--gray-600)', margin: '4px 0' }}>{n.message}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{fmtDateTime(n.created_at)}</div>
                        </div>
                        {!n.is_read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green-500)', marginTop: '6px' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="dash-panel">
              <div className="tn-gov-header">
                <div className="tn-gov-logo">🏛️</div>
                <div className="tn-gov-title">{t('tn_gov_schemes')}</div>
              </div>
              <div className="dash-panel-body" style={{ background: 'var(--green-50)' }}>
                <div className="support-grid">
                  <div className="support-card scheme-energy">
                    <div className="support-icon">⚡</div>
                    <div className="support-content">
                      <h5>{t('scheme_electricity')}</h5>
                      <p>{t('scheme_electricity_desc')}</p>
                      <ul className="mt-8">
                        <li>{t('scheme_electricity_i1')}</li>
                        <li>{t('scheme_electricity_i2')}</li>
                        <li>{t('scheme_electricity_i3')}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="support-card scheme-machinery">
                    <div className="support-icon">🚜</div>
                    <div className="support-content">
                      <h5>{t('scheme_machinery')}</h5>
                      <p>{t('scheme_machinery_desc')}</p>
                      <div className="badge badge-organic" style={{ display: 'inline-block', marginBottom: '8px' }}>{t('scheme_machinery_sub')}</div>
                    </div>
                  </div>

                  <div className="support-card scheme-finance">
                    <div className="support-icon">💰</div>
                    <div className="support-content">
                      <h5>{t('scheme_tiller_loan')}</h5>
                      <p>{t('scheme_tiller_loan_desc')}</p>
                      <ul className="mt-8">
                        <li>{t('scheme_tiller_loan_i1')}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="support-card scheme-machinery">
                    <div className="support-icon">🛡️</div>
                    <div className="support-content">
                      <h5>{t('scheme_equipment')}</h5>
                      <p>{t('scheme_equipment_desc')}</p>
                      <div className="badge badge-organic" style={{ display: 'inline-block', marginBottom: '8px' }}>{t('scheme_equipment_sub')}</div>
                    </div>
                  </div>

                  <div className="support-card scheme-water">
                    <div className="support-icon">💧</div>
                    <div className="support-content">
                      <h5>{t('scheme_pumpset')}</h5>
                      <p>{t('scheme_pumpset_desc')}</p>
                      <ul className="mt-8">
                        <li>{t('scheme_pumpset_i1')}</li>
                        <li>{t('scheme_pumpset_i2')}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="support-card scheme-infrastructure">
                    <div className="support-icon">🏗️</div>
                    <div className="support-content">
                      <h5>{t('scheme_value_addition')}</h5>
                      <p>{t('scheme_value_addition_desc')}</p>
                      <div className="badge badge-organic" style={{ display: 'inline-block', marginBottom: '8px' }}>{t('scheme_value_addition_sub')}</div>
                    </div>
                  </div>

                  <div className="support-card scheme-water">
                    <div className="support-icon">🚿</div>
                    <div className="support-content">
                      <h5>{t('scheme_micro_irrigation')}</h5>
                      <p>{t('scheme_micro_irrigation_desc')}</p>
                      <div className="badge badge-organic" style={{ display: 'inline-block', marginBottom: '8px' }}>{t('scheme_micro_irrigation_sub')}</div>
                    </div>
                  </div>

                  <div className="support-card scheme-organic">
                    <div className="support-icon">🌱</div>
                    <div className="support-content">
                      <h5>{t('scheme_foundation_seeds')}</h5>
                      <p>{t('scheme_foundation_seeds_desc')}</p>
                      <div className="badge badge-organic" style={{ display: 'inline-block', marginBottom: '8px' }}>{t('scheme_foundation_seeds_sub')}</div>
                    </div>
                  </div>

                  <div className="support-card scheme-infrastructure">
                    <div className="support-icon">🏘️</div>
                    <div className="support-content">
                      <h5>{t('scheme_kalaignar_village')}</h5>
                      <p>{t('scheme_kalaignar_village_desc')}</p>
                      <ul className="mt-8">
                        <li>{t('scheme_kalaignar_village_i1')}</li>
                        <li>{t('scheme_kalaignar_village_i2')}</li>
                        <li>{t('scheme_kalaignar_village_i3')}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="support-card scheme-organic">
                    <div className="support-icon">🌍</div>
                    <div className="support-content">
                      <h5>{t('scheme_mannuyir_kaathu')}</h5>
                      <p>{t('scheme_mannuyir_kaathu_desc')}</p>
                      <ul className="mt-8">
                        <li>{t('scheme_mannuyir_kaathu_i1')}</li>
                        <li>{t('scheme_mannuyir_kaathu_i2')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--gray-100)' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{t('reviews_received')}</h2>
              </div>
              <div style={{ padding: '24px' }}>
                {isReviewsLoading ? <div>{t('loading')}</div> : reviews.length === 0 ? <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-500)' }}>{t('no_reviews')}</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {reviews.map((r, ii) => (
                      <div key={ii} style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div><div style={{ fontWeight: 600 }}>{r.product_name}</div><div style={{ fontSize: '0.85rem' }}>{renderStars(r.overall_service)}</div></div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{fmtDate(r.created_at)}</div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '8px' }}>From: <b>{r.customer_name}</b></div>
                        {r.comment && <p style={{ fontSize: '0.95rem', color: 'var(--gray-700)', fontStyle: 'italic', margin: 0 }}>"{r.comment}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'farmers' && (
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--gray-100)' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{t('nav_farmers')}</h2>
              </div>
              <div style={{ padding: '24px' }}>
                {isCommunityLoading ? <div>Loading...</div> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                    {farmersSummary.map((f, i) => (
                      <div key={i} style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 12px', background: 'var(--green-50)', color: 'var(--green-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 600, overflow: 'hidden' }}>
                          {f.profile_photo ? <img src={getFullImageUrl(f.profile_photo)} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : (f.name || 'F')[0]}
                        </div>
                        <h4 style={{ margin: '0 0 4px' }}>{f.name}</h4>
                        <div style={{ fontSize: '0.8rem', color: 'var(--green-600)', fontWeight: 600, marginBottom: '4px' }}>{f.farm_name || 'AgriDirect Farmer'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '8px' }}>📍 {f.location || 'Tamil Nadu'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.85rem' }}>
                          {f.avg_rating ? <><span style={{color:'var(--amber-500)'}}>★</span> {f.avg_rating.toFixed(1)}</> : <span style={{color:'var(--gray-400)'}}>{t('no_ratings')}</span>}
                          <span style={{ color: 'var(--gray-300)', margin: '0 4px' }}>•</span>
                          <span style={{ color: 'var(--gray-600)' }}>{f.products_count || 0} {t('products_count')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'market' && (
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', flex: 1 }}>{t('nav_market')}</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    value={districtFilter} 
                    onChange={e => { setDistrictFilter(e.target.value); fetchMarketPrices(marketQuery, e.target.value); }}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '0.9rem' }}
                  >
                    <option value="">{t('all_locations')}</option>
                    {districts.map(d => <option key={d.id} value={d.name}>{lang === 'ta' ? (d.name_ta || d.name) : d.name}</option>)}
                  </select>
                  <input 
                    type="text" 
                    placeholder={t('search_product')} 
                    value={marketQuery} 
                    onChange={e => setMarketQuery(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && fetchMarketPrices()}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '0.9rem' }} 
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => fetchMarketPrices()}>{t('search_btn')}</button>
                </div>
              </div>
              <div style={{ padding: '24px', overflowX: 'auto' }}>
                {isCommunityLoading ? <div>{t('loading')}</div> : marketSummary.length === 0 ? <div style={{textAlign:'center', padding:'40px', color:'var(--gray-400)'}}>{t('no_price_data')}</div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--gray-50)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--gray-100)' }}>{t('product')}</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--gray-100)' }}>{t('district')}</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--gray-100)' }}>{t('price_range')}</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--gray-100)' }}>{t('updated')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketSummary.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{lang === 'ta' ? (m.name_ta || m.name) : m.name}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--gray-600)' }}>{(lang === 'ta' ? m.district_name_ta : m.district_name) || '—'}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--green-600)', fontWeight: 700 }}>₹{m.price}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--gray-400)', fontSize: '0.8rem' }}>{fmtDate(m.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}


          {activeTab === 'profile' && (
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--gray-100)', textAlign: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>My Profile</h2>
              </div>
              <div style={{ padding: '32px', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Name</label><input type="text" name="name" value={profileData.name} onChange={handleProfileChange} className="form-input" style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-300)', borderRadius: '8px' }} /></div>
                  <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Mobile</label><input type="text" value={profileData.phone} readOnly style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px', background: 'var(--gray-50)' }} /></div>
                </div>
                <div style={{ marginBottom: '16px' }}><label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Farm Name (Optional)</label><input type="text" name="farm_name" value={profileData.farm_name} onChange={handleProfileChange} className="form-input" style={{ width: '100%', padding: '12px' }} /></div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontWeight: 600 }}>{t('location')}</label>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={getFarmerLocation}>📍 {t('get_location')}</button>
                  </div>
                  <input type="text" name="location" value={profileData.location} onChange={handleProfileChange} className="form-input" style={{ width: '100%', padding: '12px' }} />
                  {locFeedback && <div style={{ fontSize: '0.8rem', marginTop: '6px', color: locFeedback.includes('✅') ? 'var(--green-600)' : 'var(--red-500)' }}>{locFeedback}</div>}
                </div>
                <div style={{ marginBottom: '16px' }}><label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>About Farm (Bio)</label><textarea name="bio" value={profileData.bio} onChange={handleProfileChange} rows="3" className="form-input" style={{ width: '100%', padding: '12px' }}></textarea></div>
                
                <div style={{ borderTop: '1px solid var(--gray-100)', marginTop: '24px', paddingTop: '24px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0 }}>🚚 {t('delivery_method')}</h4>
                    <button className="btn btn-secondary btn-xs" onClick={getFarmLocation}>📍 {t('get_farm_gps')}</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>Latitude</label>
                      <input type="number" name="lat" value={profileData.lat} onChange={handleProfileChange} placeholder="e.g. 13.0827" className="form-input" style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>Longitude</label>
                      <input type="number" name="lng" value={profileData.lng} onChange={handleProfileChange} placeholder="e.g. 80.2707" className="form-input" style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>Max Delivery Dist (km)</label>
                      <input type="number" name="max_delivery_dist" value={profileData.max_delivery_dist} onChange={handleProfileChange} placeholder="10" className="form-input" style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>Max Capacity (kg)</label>
                      <input type="number" name="max_carrying_capacity" value={profileData.max_carrying_capacity} onChange={handleProfileChange} placeholder="50" className="form-input" style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }} />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                   <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Profile Photo</label>
                   <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                     <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--green-200)', background: 'var(--gray-50)' }}>
                       <img src={photoPreview || getFullImageUrl(user.profile_photo) || undefined} alt="Preview" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                     </div>

                     {showCamera && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                          <div className="camera-container-small">
                            <video ref={videoRef} autoPlay playsInline className="camera-viewfinder" />
                            <div className="shutter-flash" id="shutterFlash"></div>
                            <div className="camera-controls">
                              <button type="button" className="camera-close" onClick={stopCamera}>✕</button>
                              <button type="button" className="btn-shutter" onClick={capturePhoto}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => document.getElementById('dashPhotoInput').click()}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Upload
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={startCamera}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            Take Photo
                          </button>
                        </div>
                        <input type="file" id="dashPhotoInput" style={{ display: 'none' }} accept="image/*" onChange={handlePhotoChange} />
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{t('recommended_photo')}</div>
                      </div>
                    </div>
                 </div>

                 <button onClick={saveProfile} disabled={isProfileSaving} className="btn btn-primary btn-full" style={{ padding: '14px' }}>
                   {isProfileSaving ? t('loading') : t('update_profile_info')}
                 </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PRODUCT MODAL */}
      {showProductModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setShowProductModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            
            <form onSubmit={handleProductSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Product Name (English)</label>
                <input required type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--gray-300)' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Name (Tamil)</label>
                <input type="text" value={productForm.name_ta} onChange={e => setProductForm({...productForm, name_ta: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--gray-300)' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Category</label>
                  <select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--gray-300)', backgroundColor: '#fff' }}>
                    <option value="vegetables">Vegetables</option>
                    <option value="fruits">Fruits</option>
                    <option value="grains">Grains</option>
                    <option value="dairy">Dairy</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Type</label>
                  <select value={productForm.product_type} onChange={e => setProductForm({...productForm, product_type: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--gray-300)', backgroundColor: '#fff' }}>
                    <option value="organic">Organic</option>
                    <option value="inorganic">Conventional</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Price (₹)</label>
                  <input required type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--gray-300)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Unit</label>
                  <select value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--gray-300)', backgroundColor: '#fff' }}>
                    <option value="kg">Per Kg</option>
                    <option value="liter">Per Liter</option>
                    <option value="bunch">Per Bunch</option>
                    <option value="piece">Per Piece</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Description</label>
                <textarea rows="3" value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--gray-300)' }}></textarea>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Upload Images (Max 5)</label>
                <input type="file" multiple accept="image/*" onChange={e => setProductImages(e.target.files)} style={{ border: '1px dashed var(--gray-300)', padding: '10px', width: '100%', borderRadius: '8px' }} />
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={isProductSaving} style={{ width: '100%', padding: '14px', borderRadius: '8px' }}>
                {isProductSaving ? 'Saving...' : 'Save Product'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default FarmerDashboard;
