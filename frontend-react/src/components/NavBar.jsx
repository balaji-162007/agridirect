import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';

const NavBar = () => {
  const auth = useAuth() || {};
  const { user, isLoggedIn, isFarmer, logout } = auth;
  const { lang, setLang, t } = useLanguage() || { t: k => k };
  const { cart } = useCart() || { cart: [] };
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const hamburgerRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownOpen && !e.target.closest('.user-menu-wrap')) setDropdownOpen(false);
      if (hamburgerOpen && hamburgerRef.current && !hamburgerRef.current.contains(e.target)) setHamburgerOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen, hamburgerOpen]);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const doSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/products.html?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const farmerSections = [
    { key: 'notifications', label: t('notifications')  || 'Notifications' },
    { key: 'farmers',       label: t('nav_farmers')    || 'Farmers' },
    { key: 'support',       label: t('farmer_support') || 'Farmer Support' },
    { key: 'market',        label: t('nav_market')     || 'Market Prices' },
  ];

  return (
    <nav className="navbar" id="navbar">
      <div className="nav-container">
        <Link to={isFarmer ? "/farmer-dashboard.html" : "/index.html"} className="brand">
          <span className="brand-icon">🌿</span>
          <span className="brand-name">AgriDirect</span>
        </Link>

        {!isFarmer && (
          <div className="nav-search">
            <form className="search-wrap" onSubmit={doSearch}>
              <input
                type="text"
                placeholder={t('search_ph') || "Search vegetables, fruits, grains…"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="search-btn">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
            </form>
          </div>
        )}

        <div className="nav-links">
          {!isFarmer && (
            <>
              <Link className="nav-link" to="/index.html">{t('nav_home') || 'Home'}</Link>
              <Link className="nav-link" to="/products.html">{t('nav_products') || 'Products'}</Link>
              <Link className="nav-link" to="/products.html?section=farmers">{t('nav_farmers') || 'Farmers'}</Link>
              <Link className="nav-link" to="/products.html?section=market">{t('nav_market') || 'Market Prices'}</Link>
            </>
          )}
        </div>

        <div className="nav-actions">
          <div className="lang-switcher">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
            <span className="lang-sep">|</span>
            <button className={`lang-btn ${lang === 'ta' ? 'active' : ''}`} onClick={() => setLang('ta')}>த</button>
          </div>

          {!isFarmer && (
            <Link to="/cart.html" className="cart-icon-btn" title="Cart">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </Link>
          )}

          {/* ── Hamburger: only for farmers, only visible on mobile ── */}
          {isFarmer && isLoggedIn && (
            <div className="farmer-hamburger-wrap" ref={hamburgerRef}>
              <button
                className="farmer-hamburger-btn"
                onClick={() => setHamburgerOpen(o => !o)}
                aria-label="Dashboard menu"
              >
                <span className="hb-line" />
                <span className="hb-line" />
                <span className="hb-line" />
              </button>

              {hamburgerOpen && (
                <div className="farmer-hamburger-menu">
                  {farmerSections.map(s => (
                    <button
                      key={s.key}
                      className="farmer-hb-item"
                      onClick={() => { navigate(`/farmer-dashboard.html?section=${s.key}`); setHamburgerOpen(false); }}
                    >
                      {s.label}
                    </button>
                  ))}
                  <div className="farmer-hb-divider" />
                  <button
                    className="farmer-hb-item farmer-hb-logout"
                    onClick={() => { logout(); setHamburgerOpen(false); }}
                  >
                    {t('nav_logout') || 'Logout'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!isLoggedIn ? (
            <Link className="btn-nav-login" to="/login.html">{t('nav_login') || 'Login'}</Link>
          ) : (
            <div className="user-menu-wrap" style={{ position: 'relative' }}>
              <div
                className="user-avatar"
                id="userAvatar"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{ cursor: 'pointer' }}
              >
                {user?.profile_photo ? (
                  <img
                    src={user.profile_photo.startsWith('http') ? user.profile_photo : `https://agridirect-zwew.onrender.com${user.profile_photo}`}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    alt="User"
                  />
                ) : (
                  <span>{(user?.name || 'U')[0].toUpperCase()}</span>
                )}
              </div>
              {dropdownOpen && (
                <div className="user-dropdown" id="userDropdown" style={{ display: 'block' }}>
                  <Link to={isFarmer ? '/farmer-dashboard.html?section=dashboard' : '/customer-dashboard.html?section=profile'} onClick={() => setDropdownOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    <span>{t('nav_dashboard') || 'Dashboard'}</span>
                  </Link>
                  <Link to={isFarmer ? '/farmer-dashboard.html?section=orders' : '/orders.html'} onClick={() => setDropdownOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V8"/><path d="M1 3H23V8H1V3Z"/><path d="M10 12H14"/></svg>
                    <span>{t('nav_orders') || 'Orders'}</span>
                  </Link>
                  <Link to={isFarmer ? '/farmer-dashboard.html?section=profile' : '/customer-dashboard.html?section=profile'} onClick={() => setDropdownOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>{t('nav_profile') || 'Profile'}</span>
                  </Link>
                  <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--gray-100)' }} />
                  <button onClick={() => { logout(); setDropdownOpen(false); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    <span>{t('nav_logout') || 'Logout'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
