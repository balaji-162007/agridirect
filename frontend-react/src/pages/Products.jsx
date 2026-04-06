import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { API, BASE_URL, getFullImageUrl } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import ProductImageSlider from '../components/ProductImageSlider';
import Skeleton, { CardSkeleton } from '../components/Skeleton';

// Utility components


const ProductCard = ({ p, onAddToCart }) => {
  const { t, currentLang } = useLanguage();
  const name = currentLang === 'ta' && p.name_ta ? p.name_ta : p.name;
  const isOutOfStock = (p.quantity || 0) <= 0;
  const unitLabel = t(p.category === 'Dairy' ? 'liter' : (p.unit || 'kg'));

  let priceDiff = null;
  if (p.market_price) {
    const pct = (((p.price || 0) - p.market_price) / p.market_price * 100).toFixed(0);
    if (pct < 0) {
      priceDiff = <span style={{color: 'var(--green-600)', fontSize: '.68rem', fontWeight: 700}}>▼ {Math.abs(pct)}% below market</span>;
    } else if (pct > 0) {
      priceDiff = <span style={{color: 'var(--red-500)', fontSize: '.68rem', fontWeight: 700}}>▲ {pct}% above market</span>;
    }
  }

  const navigate = useNavigate();

  return (
    <div className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`} onClick={() => navigate(`/product/${p.id}`)}>
      <div className="product-card-img-container" style={{ position: 'relative', height: '200px', backgroundColor: 'var(--gray-50)', overflow: 'hidden' }}>
        <ProductImageSlider images={p.images} alt={name} />
        <div className="product-card-badges" style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px', flexDirection: 'column' }}>
          <span className={`badge ${p.product_type === 'organic' ? 'badge-organic' : 'badge-inorganic'}`} style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: p.product_type === 'organic' ? 'var(--green-500)' : 'var(--blue-500)', color: '#fff' }}>
            {p.product_type === 'organic' ? '🌱 ' + t('organic') : t('inorganic')}
          </span>
          {isOutOfStock && <span className="badge" style={{ backgroundColor: 'var(--gray-500)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>{t('out_of_stock')}</span>}
        </div>
      </div>
      <div className="product-card-body" style={{ padding: '16px' }}>
        <div className="product-card-category" style={{ fontSize: '0.7rem', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 700 }}>{p.category || 'Produce'}</div>
        <div className="product-card-name" style={{ fontWeight: 700, fontSize: '1rem', margin: '4px 0', height: '2.4rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHighlight: '1.2' }}>{name}</div>
        <div className="product-card-farmer" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', cursor: 'pointer', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); navigate(`/products.html?section=farmers&search=${encodeURIComponent(p.farmer_name || '')}`); }}>
          <span style={{ color: 'var(--gray-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🧑‍🌾 {p.farmer_name || 'Farmer'}</span>
        </div>
      </div>
      <div className="product-card-footer" style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="product-price" style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--gray-900)' }}>
            ₹{p.price || 0} <span className="product-price-unit" style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--gray-500)' }}>/ {unitLabel}</span>
          </div>
          {p.market_price && <div className="product-market-price text-truncate" style={{ fontSize: '.65rem', color: 'var(--gray-400)' }}>Market: ₹{p.market_price}/kg</div>}
          <div style={{ lineHeight: 1 }}>{priceDiff}</div>
        </div>
        <button className="btn-add-cart" onClick={(e) => { e.stopPropagation(); onAddToCart(p); }} title={isOutOfStock ? t('out_of_stock') : t('add_to_cart')} disabled={isOutOfStock} style={{ width: '38px', height: '38px', borderRadius: '50%', border: 'none', backgroundColor: isOutOfStock ? 'var(--gray-200)' : 'var(--green-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isOutOfStock ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------------- //

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLanguage();
  const { addToCart } = useCart();
  
  const section = searchParams.get('section') || 'products';
  
  // Products State
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filters State
  const [filters, setFilters] = useState({
    page: parseInt(searchParams.get('page')) || 1,
    category: searchParams.get('cat') || 'all',
    max_price: 500,
    organic: false,
    inorganic: false,
    farmer_name: '',
    location: '',
    sort: 'newest',
    search: searchParams.get('search') || '',
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Farmers State
  const [farmers, setFarmers] = useState([]);
  const [isFarmersLoading, setIsFarmersLoading] = useState(false);

  // Market Prices State
  const [marketPrices, setMarketPrices] = useState([]);
  const [isMarketLoading, setIsMarketLoading] = useState(false);

  // Data Fetching
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams();
      if (filters.category && filters.category !== 'all') q.set('category', filters.category);
      if (filters.max_price < 500) q.set('max_price', filters.max_price);
      if (filters.organic && !filters.inorganic) q.set('product_type', 'organic');
      if (filters.inorganic && !filters.organic) q.set('product_type', 'inorganic');
      if (filters.farmer_name) q.set('farmer_name', filters.farmer_name);
      if (filters.location) q.set('location', filters.location);
      if (filters.sort) q.set('sort', filters.sort);
      if (filters.search) q.set('search', filters.search);
      q.set('page', filters.page);
      q.set('limit', 12);

      const data = await API.getProducts(Object.fromEntries(q));
      console.log("PRODUCT DATA:", data);
      setProducts(data?.products ?? data ?? []);
      setTotalProducts(data?.total ?? (Array.isArray(data) ? data.length : 0));
      setTotalPages(data?.pages ?? 1);
    } catch (e) {
      console.error("Products fetch error:", e);
      // Step 6: Render free tier timeout retry
      setTimeout(fetchProducts, 3000);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchFarmers = useCallback(async () => {
    setIsFarmersLoading(true);
    try {
      const data = await API.getFarmers();
      let f = data?.farmers || [];
      if (filters.search) {
        f = f.filter(x => (x.name || '').toLowerCase().includes(filters.search.toLowerCase()));
      }
      setFarmers(f);
    } catch (e) {
      console.error(e);
      setFarmers([]);
    } finally {
      setIsFarmersLoading(false);
    }
  }, [filters.search]);

  const fetchMarketPrices = useCallback(async () => {
    setIsMarketLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.category && filters.category !== 'all') p.set('category', filters.category);
      
      const data = await API.getMarketPrices(Object.fromEntries(p));
      setMarketPrices(data?.prices || []);
    } catch (e) {
      console.error(e);
      setMarketPrices([]);
    } finally {
      setIsMarketLoading(false);
    }
  }, [filters.category]);

  // Effect to trigger fetch on section or filter change
  useEffect(() => {
    // Debounce the fetch by 300ms
    const timer = setTimeout(() => {
      if (section === 'products') fetchProducts();
      else if (section === 'farmers') fetchFarmers();
      else if (section === 'market') fetchMarketPrices();
      
      // Sync URL
      const newParams = new URLSearchParams();
      if (section !== 'products') newParams.set('section', section);
      if (filters.search) newParams.set('search', filters.search);
      if (filters.category !== 'all') newParams.set('cat', filters.category);
      if (filters.page > 1) newParams.set('page', filters.page);
      setSearchParams(newParams, { replace: true });

    }, 300);
    return () => clearTimeout(timer);
  }, [filters, section, fetchProducts, fetchFarmers, fetchMarketPrices, setSearchParams]);


  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: key === 'page' ? value : 1 }));
  };

  const clearFilters = () => {
    setFilters({
      page: 1, category: 'all', max_price: 500, organic: false, inorganic: false,
      farmer_name: '', location: '', sort: 'newest', search: ''
    });
  };

  const handleTabChange = (tab) => {
    setSearchParams(tab === 'products' ? {} : { section: tab });
  };

  return (
    <>
      <div className="page-header" style={{ padding: '40px 0', background: 'var(--green-50)', borderBottom: '1px solid var(--green-100)' }}>
        <div className="container page-header-inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '16px', color: 'var(--green-900)' }}>
            {section === 'products' ? 'Fresh Produce' : section === 'farmers' ? 'Our Farmers' : 'Market Prices'}
          </h1>
          
          <div style={{ display: 'flex', gap: '8px', background: '#fff', padding: '6px', borderRadius: '50px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <button className={`btn ${section === 'products' ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: '50px', padding: '8px 20px' }} onClick={() => handleTabChange('products')}>Products</button>
            <button className={`btn ${section === 'farmers' ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: '50px', padding: '8px 20px' }} onClick={() => handleTabChange('farmers')}>Farmers</button>
            <button className={`btn ${section === 'market' ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: '50px', padding: '8px 20px' }} onClick={() => handleTabChange('market')}>Market Prices</button>
          </div>
        </div>
      </div>

      <div className="container section" style={{ padding: '40px 20px' }}>
        <div style={{ display: 'flex', gap: '32px', position: 'relative' }}>
          
          {/* SIDEBAR (Visible for products tab) */}
          {section === 'products' && (
            <aside 
              className={`sidebar ${sidebarOpen ? 'open' : ''}`} 
              style={{ 
                width: '280px', 
                flexShrink: 0, 
                display: !isMobile || sidebarOpen ? 'block' : 'none', 
                background: '#fff', 
                border: isMobile ? 'none' : '1px solid var(--gray-200)', 
                padding: isMobile ? '20px' : '24px', 
                borderRadius: '16px', 
                position: isMobile ? 'fixed' : 'sticky', 
                top: '100px', 
                bottom: isMobile ? 0 : 'auto', 
                left: 0, 
                zIndex: 100, 
                overflowY: 'auto', 
                maxHeight: isMobile ? '100vh' : 'calc(100vh - 120px)' 
              }}
            >
            {isMobile && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span className="fw-700">Filter & Sort</span>
                <button onClick={() => setSidebarOpen(false)} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
              </div>
            )}
            
            <div className="sidebar-section" style={{ marginBottom: '24px' }}>
              <div className="sidebar-title" style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.5px' }}>Category</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['all', 'vegetables', 'fruits', 'grains', 'dairy'].map(c => (
                  <button key={c} className={`chip ${filters.category === c ? 'active' : ''}`} style={{ padding: '6px 14px', borderRadius: '50px', border: filters.category === c ? 'none' : '1px solid var(--gray-200)', background: filters.category === c ? 'var(--green-600)' : '#fff', color: filters.category === c ? '#fff' : 'var(--gray-700)', cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => updateFilter('category', c)}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-section" style={{ marginBottom: '24px' }}>
              <div className="sidebar-title" style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.5px' }}>Search</div>
              <input type="text" className="form-input" value={filters.search} onChange={e => updateFilter('search', e.target.value)} placeholder="Keywords..." style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '0.9rem' }} />
            </div>

            {section === 'products' && (
              <>
                <div className="sidebar-section" style={{ marginBottom: '24px' }}>
                  <div className="sidebar-title" style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.5px' }}>Price Range: Up to ₹{filters.max_price}/kg</div>
                  <input type="range" min="0" max="500" value={filters.max_price} onChange={e => updateFilter('max_price', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--green-500)' }} />
                </div>
                
                <div className="sidebar-section" style={{ marginBottom: '24px' }}>
                  <div className="sidebar-title" style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.5px' }}>Product Type</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}><input type="checkbox" checked={filters.organic} onChange={e => updateFilter('organic', e.target.checked)} style={{ transform: 'scale(1.2)', accentColor: 'var(--green-500)' }} /> Organic</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked={filters.inorganic} onChange={e => updateFilter('inorganic', e.target.checked)} style={{ transform: 'scale(1.2)', accentColor: 'var(--green-500)' }} /> Conventional</label>
                </div>

                <div className="sidebar-section" style={{ marginBottom: '24px' }}>
                  <div className="sidebar-title" style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.5px' }}>Farmer Name</div>
                  <input type="text" className="form-input" value={filters.farmer_name} onChange={e => updateFilter('farmer_name', e.target.value)} placeholder="Search farmer..." style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '0.9rem' }} />
                </div>
                
                <div className="sidebar-section" style={{ marginBottom: '24px' }}>
                 <div className="sidebar-title" style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.5px' }}>Location</div>
                 <input type="text" className="form-input" value={filters.location} onChange={e => updateFilter('location', e.target.value)} placeholder="City or Village..." style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '0.9rem' }} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-primary btn-full" onClick={() => setSidebarOpen(false)} style={{ padding: '10px', borderRadius: '8px' }}>Apply Filters</button>
              <button className="btn btn-ghost btn-full" onClick={clearFilters} style={{ padding: '10px', borderRadius: '8px' }}>Clear</button>
            </div>
          </aside>
          )}

          {/* MAIN CONTENT */}
          <div className="content-area" style={{ flex: 1, minWidth: 0 }}>
            {isMobile && section === 'products' && (
              <button className="btn btn-secondary btn-full mb-16" onClick={() => setSidebarOpen(true)} style={{ width: '100%', marginBottom: '20px', padding: '12px', borderRadius: '8px', border: '1px solid var(--gray-200)', background: '#fff' }}>
                🔍 Filter & Sort Results
              </button>
            )}

            {section === 'products' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--gray-500)' }}>{isLoading ? 'Loading...' : `Showing ${totalProducts} products`}</span>
                  <select value={filters.sort} onChange={e => updateFilter('sort', e.target.value)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--gray-200)', outline: 'none', background: '#fff' }}>
                    <option value="newest">Newest First</option>
                    <option value="price_asc">Price: Low → High</option>
                    <option value="price_desc">Price: High → Low</option>
                    <option value="rating">Top Rated</option>
                    <option value="name">Name A-Z</option>
                  </select>
                </div>

                {isLoading ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
                     {Array(8).fill(0).map((_,i) => <CardSkeleton key={i} />)}
                  </div>
                ) : products.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--gray-50)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🌾</div>
                    <h3>No products found</h3>
                    <p style={{ color: 'var(--gray-500)', marginTop: '8px' }}>Try adjusting your filters or search term.</p>
                    <button className="btn btn-secondary mt-16" onClick={clearFilters}>Clear Filters</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
                      {products.map(p => <ProductCard key={p.id} p={p} onAddToCart={(prod) => addToCart(prod, 1)} />)}
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '40px' }}>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                          <button key={n} className={`btn ${n === filters.page ? 'btn-primary' : 'btn-ghost'}`} style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }} onClick={() => updateFilter('page', n)}>
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {section === 'farmers' && (
              <>
                {isFarmersLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-400)' }}>Loading farmers...</div>
                ) : farmers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--gray-50)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🧑‍🌾</div>
                    <h3>No farmers found</h3>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                    {farmers.map(f => (
                      <div key={f.id} style={{ border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '24px', background: '#fff', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                         <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--green-100)', color: 'var(--green-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', marginBottom: '16px', fontWeight: 600, overflow: 'hidden' }}>
                           {f.profile_photo ? (
                             <img src={getFullImageUrl(f.profile_photo)} alt={f.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                           ) : (
                             f.name.charAt(0).toUpperCase()
                           )}
                         </div>
                         <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{f.name}</h3>
                         {f.farm_name && <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '4px' }}>🌾 {f.farm_name}</div>}
                         <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginTop: '8px' }}>📍 {f.location || 'Tamil Nadu'}</div>
                         <div style={{ display: 'flex', gap: '16px', marginTop: '20px', borderTop: '1px solid var(--gray-100)', paddingTop: '20px', width: '100%', justifyContent: 'space-around' }}>
                           <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--green-700)' }}>{f.products_count || 0}</div><div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Products</div></div>
                           <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{f.avg_rating ? `${f.avg_rating}★` : '—'}</div><div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Rating</div></div>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {section === 'market' && (
              <>
                {isMarketLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-400)' }}>Loading market prices...</div>
                ) : marketPrices.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--gray-50)', borderRadius: '16px' }}>
                    <h3>No market prices available for this selection</h3>
                  </div>
                ) : (
                  <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                            <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Product</th>
                            <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Category</th>
                            <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Market Price</th>
                            <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Change</th>
                            <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>District</th>
                            <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Market</th>
                            <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marketPrices.map((p, i) => {
                            const changeColor = p.change_pct > 0 ? 'var(--red-500)' : p.change_pct < 0 ? 'var(--green-600)' : 'var(--gray-500)';
                            const changeIcon = p.change_pct > 0 ? '▲' : p.change_pct < 0 ? '▼' : '—';
                            const updatedDate = p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—';
                            
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                <td style={{ padding: '16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--green-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                      {p.category === 'vegetables' ? '🥕' : p.category === 'fruits' ? '🍎' : '🌾'}
                                    </div>
                                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                                  </div>
                                </td>
                                <td style={{ padding: '16px', fontSize: '0.9rem', color: 'var(--gray-600)', textTransform: 'capitalize' }}>{p.category}</td>
                                <td style={{ padding: '16px', fontWeight: 600, color: 'var(--green-700)' }}>₹{p.price}/kg</td>
                                <td style={{ padding: '16px', color: changeColor, fontWeight: 600, fontSize: '0.9rem' }}>
                                  {changeIcon} {Math.abs(p.change_pct || 0)}%
                                </td>
                                <td style={{ padding: '16px', fontSize: '0.9rem', color: 'var(--gray-600)' }}>{p.district_name || '—'}</td>
                                <td style={{ padding: '16px', fontSize: '0.9rem', color: 'var(--gray-600)' }}>{p.market || '—'}</td>
                                <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--gray-400)' }}>{updatedDate}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
};

export default Products;
