import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const Footer = () => {
  const { t } = useLanguage();
  const { isFarmer } = useAuth();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to={isFarmer ? "/farmer-dashboard.html" : "/index.html"} className="brand" style={{ marginBottom: '12px' }}>
              <span className="brand-icon">🌿</span>
              <span className="brand-name">AgriDirect</span>
            </Link>
            <p>{t('footer_tag') || 'Connecting farmers directly with customers across Tamil Nadu.'}</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '18px', fontSize: '1.3rem' }}>
              <span style={{ cursor: 'pointer' }}>📘</span>
              <span style={{ cursor: 'pointer' }}>📷</span>
              <span style={{ cursor: 'pointer' }}>🐦</span>
            </div>
          </div>
          {!isFarmer && (
            <>
              <div className="footer-col">
                <h5>{t('footer_links') || 'Quick Links'}</h5>
                <Link to="/index.html">{t('nav_home') || 'Home'}</Link>
                <Link to="/products.html">{t('nav_products') || 'Products'}</Link>
                <Link to="/cart.html">{t('nav_cart') || 'Cart'}</Link>
              </div>
              <div className="footer-col">
                <h5>{t('footer_cats') || 'Categories'}</h5>
                <Link to="/products.html?cat=vegetables">{t('cat_vegetables') || 'Vegetables'}</Link>
                <Link to="/products.html?cat=fruits">{t('cat_fruits') || 'Fruits'}</Link>
                <Link to="/products.html?cat=grains">{t('cat_grains') || 'Grains'}</Link>
                <Link to="/products.html?cat=dairy">{t('cat_dairy') || 'Dairy'}</Link>
              </div>
            </>
          )}
          <div className="footer-col">
            <h5>{t('footer_support')}</h5>
            <a href="#">{t('help_center') || 'Help Center'}</a>
            <a href="#">{t('privacy_policy') || 'Privacy Policy'}</a>
            <a href="#">{t('terms_service') || 'Terms of Service'}</a>
            <a href="#">{t('contact_us') || 'Contact Us'}</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2024 AgriDirect. <span>{t('footer_rights')}</span></span>
          <span dangerouslySetInnerHTML={{ __html: t('made_with_heart') || 'Made with ❤️ for Tamil Nadu Farmers' }} />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
