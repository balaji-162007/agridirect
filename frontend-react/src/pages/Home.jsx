import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';

const Home = () => {
  const { t } = useLanguage();
  const { isLoggedIn, isFarmer } = useAuth();

  const [featured, setFeatured] = useState([]);
  const [counts, setCounts] = useState({ total: 0 });
  const [farmers, setFarmers] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const [prodRes, countRes, farmRes, revRes] = await Promise.all([
          API.getProducts({ featured: true, limit: 4 }),
          API.getCategoryCounts(),
          API.getFarmers(),
          API.getFeaturedReviews()
        ]);
        
        setFeatured(prodRes?.products || []);
        setCounts(countRes || { total: 0 });
        setFarmers((farmRes?.farmers || []).slice(0, 4));
        setReviews(revRes?.reviews || []);
      } catch (e) {
        console.error("Home data fetch error:", e);
      }
    };
    
    fetchHomeData();
  }, []);

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-eyebrow"><span className="pulse-dot"></span><span>{t('hero_eyebrow') || 'Fresh from the Farm'}</span></div>
          <h1 className="hero-title"><span>{t('hero_h1a') || 'Buy Direct from'}</span><br/><em>{t('hero_h1b') || 'Local Farmers'}</em></h1>
          <p className="hero-sub">{t('hero_sub') || 'Get the freshest produce at fair prices. Support local farmers and know exactly where your food comes from.'}</p>
          <div className="hero-cta">
            <Link to="/products.html" className="btn btn-primary btn-lg">{t('hero_shop') || 'Shop Now'}</Link>
            {!isLoggedIn && !isFarmer && (
              <Link to="/login.html?mode=register&role=farmer" className="btn btn-secondary btn-lg">{t('hero_farmer') || "I'm a Farmer"}</Link>
            )}
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card-stack">
            <div className="hero-card hero-card-main">
              <div className="hero-card-thumb">🍅</div>
              <div className="hero-card-title">{t('hero_card1_title') || 'Fresh Tomatoes'}</div>
              <div className="hero-card-price">₹45 / kg</div>
              <div style={{fontSize:'.7rem', color:'var(--gray-400)', marginTop:'4px'}}>🌾 Rajan Farms, Coimbatore</div>
              <span className="badge badge-organic mt-8">{t('organic') || '🌱 Organic'}</span>
            </div>
            <div className="hero-card hero-card-sec">
              <div className="hero-card-thumb">🥕</div>
              <div className="hero-card-title">{t('hero_card2_title') || 'Local Carrots'}</div>
              <div className="hero-card-price">₹30 / kg</div>
              <span className="badge badge-amber mt-8">🏆 Best Seller</span>
            </div>
            <div className="hero-badge">🌱 100% Organic</div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section-sm" style={{ background: 'var(--gray-50)' }}>
        <div className="container">
          <div className="flex items-center justify-between mb-24">
            <h2>{t('cat_heading') || 'Shop by Category'}</h2>
          </div>
          <div className="cat-scroll">
            <Link to="/products.html?cat=all" className="cat-card active"><div className="cat-icon">🛒</div><div className="cat-name">{t('cat_all') || 'All'}</div><div className="cat-count">{counts.total} items</div></Link>
            <Link to="/products.html?cat=vegetables" className="cat-card"><div className="cat-icon">🥬</div><div className="cat-name">{t('cat_vegetables') || 'Vegetables'}</div><div className="cat-count">{counts.vegetables || 0} items</div></Link>
            <Link to="/products.html?cat=fruits" className="cat-card"><div className="cat-icon">🍎</div><div className="cat-name">{t('cat_fruits') || 'Fruits'}</div><div className="cat-count">{counts.fruits || 0} items</div></Link>
            <Link to="/products.html?cat=grains" className="cat-card"><div className="cat-icon">🌾</div><div className="cat-name">{t('cat_grains') || 'Grains'}</div><div className="cat-count">{counts.grains || 0} items</div></Link>
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="section">
        <div className="container">
          <div className="flex items-center justify-between mb-24">
            <div><span className="eyebrow">Freshly Listed</span><h2>{t('featured') || 'Featured Products'}</h2></div>
            <Link to="/products.html" className="btn btn-ghost btn-sm">{t('see_all') || 'See All →'}</Link>
          </div>
          <div className="grid-auto">
            {featured.length === 0 ? (
               <div style={{gridColumn:'1/-1', textAlign:'center', color:'var(--gray-400)'}}>Loading products...</div>
            ) : (
               featured.map(p => <ProductCard key={p.id} product={p} />)
            )}
          </div>
        </div>
      </section>

      {/* MARKET BANNER */}
      <section className="section-sm">
        <div className="container">
          <div className="market-banner">
            <div>
              <span className="eyebrow" style={{ color: 'var(--earth-100)' }}>Price Transparency</span>
              <h2>{t('market_title') || 'Current Market Prices'}</h2>
              <p>{t('market_sub') || 'Compare farmer prices with current market rates before you buy.'}</p>
            </div>
            <Link to="/products.html?section=market" className="btn btn-primary btn-lg" style={{ flexShrink: 0 }}>View Market Prices</Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;
