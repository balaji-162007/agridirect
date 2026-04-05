import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const MobileNav = () => {
  const { isFarmer, isLoggedIn } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // If not logged in, show default customer nav
  // If logged in as customer, show customer nav
  // If logged in as farmer, show farmer nav
  
  const isFarmerRoute = location.pathname.includes('farmer-dashboard');
  const currentSection = searchParams.get('section') || 'dashboard';

  if (isFarmer && isFarmerRoute) {
    return (
      <nav className="mobile-bottom-nav">
        <Link 
          to="/farmer-dashboard.html?section=dashboard" 
          className={`nav-item ${currentSection === 'dashboard' ? 'active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="24" width="24">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>{t('nav_home')}</span>
        </Link>
        <Link 
          to="/farmer-dashboard.html?section=products" 
          className={`nav-item ${currentSection === 'products' ? 'active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="24" width="24">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5"/>
            <path d="M12 22V12"/>
          </svg>
          <span>{t('nav_products')}</span>
        </Link>
        <Link 
          to="/farmer-dashboard.html?section=orders" 
          className={`nav-item ${currentSection === 'orders' ? 'active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="24" width="24">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            <path d="M9 14h6"/>
            <path d="M9 18h6"/>
            <path d="M9 10h6"/>
          </svg>
          <span>{t('nav_orders')}</span>
        </Link>
        <Link 
          to="/farmer-dashboard.html?section=profile" 
          className={`nav-item ${currentSection === 'profile' ? 'active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="24" width="24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>{t('nav_profile')}</span>
        </Link>
      </nav>
    );
  }

  // Hide for farmers on other pages to not conflict with store nav? 
  // Or show store nav for them too? Legacy hides it for farmers on other pages usually.
  if (isFarmer && !isFarmerRoute) return null;

  return (
    <nav className="mobile-bottom-nav">
      <Link 
        to={isFarmer ? "/farmer-dashboard.html" : "/index.html"} 
        className={`nav-item ${location.pathname === '/' || location.pathname === '/index.html' || location.pathname === '/farmer-dashboard.html' ? 'active' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="24" width="24">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>{t('nav_home')}</span>
      </Link>
      <Link to="/products.html" className={`nav-item ${location.pathname === '/products.html' ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="24" width="24">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <span>{t('nav_products')}</span>
      </Link>
      <Link to="/orders.html" className={`nav-item ${location.pathname === '/orders.html' ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="24" width="24">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
          <path d="M3 6h18"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <span>{t('nav_orders')}</span>
      </Link>
      <Link to="/customer-dashboard.html?section=profile" className={`nav-item ${location.pathname === '/customer-dashboard.html' ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="24" width="24">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span>{t('nav_profile')}</span>
      </Link>
    </nav>
  );
};

export default MobileNav;
