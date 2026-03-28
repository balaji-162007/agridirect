/* ============================================================
   products.js  –  Product listing, search, filters, card render
   ============================================================ */

/* ── Shared product-card renderer ── */
window.renderProductCard = function(p) {
  if (!p) return '';
  const name = currentLang === 'ta' ? (p.name_ta || p.name || 'Product') : (p.name || 'Product');
  const wishlisted = (JSON.parse(localStorage.getItem('agri_wishlist') || '[]')).includes(p.id);

  let priceDiff = '';
  if (p.market_price) {
    const pct = (((p.price || 0) - p.market_price) / p.market_price * 100).toFixed(0);
    priceDiff = pct < 0
      ? `<span style="color:var(--green-600);font-size:.68rem;font-weight:700">▼ ${Math.abs(pct)}% below market</span>`
      : pct > 0
        ? `<span style="color:var(--red-500);font-size:.68rem;font-weight:700">▲ ${pct}% above market</span>`
        : '';
  }

  const isOutOfStock = (p.quantity || 0) <= 0;
  const unitLabel = t(p.category === 'Dairy' ? 'liter' : (p.unit || 'kg'));

  return `
  <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-id="${p.id}" onclick="location.href='products.html?id=${p.id}'">
    <div class="product-card-img-container">
      ${p.images?.length > 0
        ? `<img src="${getFullImageUrl(p.images[0])}" alt="${name}" class="product-card-img-new" loading="lazy">`
        : `<div class="placeholder">${getCategoryEmoji(p.category)}</div>`}
      
      <div class="product-card-badges">
        <span class="badge ${p.product_type === 'organic' ? 'badge-organic' : 'badge-inorganic'}">
          ${p.product_type === 'organic' ? '🌱 '+t('organic') : t('inorganic')}
        </span>
        ${isOutOfStock ? `<span class="badge badge-sale" style="background:var(--gray-500)">${t('out_of_stock')}</span>` : ''}
      </div>
      <button class="product-card-wish ${wishlisted ? 'active' : ''}"
        onclick="event.stopPropagation();toggleWishlist(${p.id},this)">
        <svg width="13" height="13" viewBox="0 0 24 24"
          fill="${wishlisted ? 'currentColor' : 'none'}"
          stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
    </div>
    <div class="product-card-body">
      <div class="product-card-category">${p.category || 'Produce'}</div>
      <div class="product-card-name">${name}</div>
      <div class="product-card-farmer">
        <div class="farmer-avatar-sm">
          ${p.farmer_photo 
            ? `<img src="${getFullImageUrl(p.farmer_photo)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.textContent='${(p.farmer_name||'F')[0].toUpperCase()}'">`
            : (p.farmer_name||'F')[0].toUpperCase()}
        </div>
        <span>${p.farmer_name || 'Farmer'}</span>
      </div>
    </div>
    <div class="product-card-footer">
      <div style="flex:1">
        <div class="product-price">₹${p.price || 0}
          <span class="product-price-unit">/ ${unitLabel}</span>
        </div>
        ${p.market_price ? `<div class="product-market-price" style="font-size:.7rem; color:var(--gray-400)">Market: ₹${p.market_price}/kg</div>` : ''}
        ${priceDiff}
      </div>
      <button class="btn-add-cart" onclick="event.stopPropagation();handleAddToCart(${p.id},this)" 
        title="${isOutOfStock ? t('out_of_stock') : t('add_to_cart')}"
        ${isOutOfStock ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  </div>`;
}

/* ── Slider Helpers ── */
window.moveSlider = function(id, dir) {
  const slider = document.getElementById(`slider-${id}`);
  if (!slider) return;
  const width = slider.offsetWidth;
  slider.scrollBy({ left: width * dir, behavior: 'smooth' });
};

window.updateSliderDots = function(id, el) {
  const dotsContainer = document.getElementById(`dots-${id}`);
  if (!dotsContainer) return;
  const index = Math.round(el.scrollLeft / el.offsetWidth);
  const dots = dotsContainer.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
};

/* ── Skeleton HTML ── */
function skeletonCard() {
  return `<div class="product-card">
    <div class="skeleton" style="height:200px;border-radius:20px 20px 0 0"></div>
    <div class="card-body" style="display:flex;flex-direction:column;gap:8px">
      <div class="skeleton" style="height:11px;width:45%"></div>
      <div class="skeleton" style="height:15px;width:75%"></div>
      <div class="skeleton" style="height:11px;width:55%"></div>
    </div>
  </div>`;
}

/* ── Wishlist toggle ── */
function toggleWishlist(id, btn) {
  let wl = JSON.parse(localStorage.getItem('agri_wishlist') || '[]');
  const i = wl.indexOf(id);
  if (i > -1) { wl.splice(i,1); } else { wl.push(id); }
  localStorage.setItem('agri_wishlist', JSON.stringify(wl));
  const wl2 = wl.includes(id);
  if (btn) {
    btn.classList.toggle('active', wl2);
    btn.querySelector('path')?.setAttribute('fill', wl2 ? 'currentColor' : 'none');
  }
  showToast(wl2 ? 'Added to wishlist ❤️' : 'Removed from wishlist', 'info');
}

/* ============================================================
   PRODUCTS LISTING PAGE  (only runs on products.html)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('productsGrid')) {
    _initProductsPage();
  }
});

function _initProductsPage() {
  let _state = {
    page: 1, totalPages: 1,
    cat: 'all', maxPrice: 500, organic: false, inorganic: false,
    farmer: '', location: '', sort: 'newest', search: '',
  };
  let _allSectionFarmers = [];

  /* ── 1. Define internal functions first (hoisted) ── */
  
  async function _load(page = 1) {
    const layout = document.querySelector('.sidebar-layout');
    if (layout) layout.classList.remove('full-width');

    _state.page = page;
    const grid  = document.getElementById('productsGrid');
    const countEl = document.getElementById('productCount');

    if (!grid) return;
    
    // Explicitly show grid and section
    grid.style.display = 'grid';
    const sidebar = document.getElementById('sharedSidebar');
    if (sidebar) {
      sidebar.style.display = 'block';
      sidebar.classList.remove('open');
    }
    const mobileToggle = document.getElementById('mobileFilterToggle');
    if (mobileToggle) mobileToggle.style.display = 'inline-flex';

    const listingSec = document.getElementById('listingSection');
    if (listingSec) listingSec.style.display = 'block';
    const detailSec = document.getElementById('productDetail');
    if (detailSec) detailSec.style.display = 'none';
    const farmersSec = document.getElementById('farmersSection');
    if (farmersSec) farmersSec.style.display = 'none';
    const marketSec = document.getElementById('marketSection');
    if (marketSec) marketSec.style.display = 'none';

    // Show listing-specific filters
    const priceFilter = document.getElementById('filterPriceRange');
    if (priceFilter) priceFilter.style.display = 'block';
    const typeFilter = document.getElementById('filterProductType');
    if (typeFilter) typeFilter.style.display = 'block';

    // Show skeletons while loading
    grid.innerHTML = Array(8).fill(null).map(() => skeletonCard()).join('');
    if (countEl) countEl.textContent = 'Fetching products...';

    const q = new URLSearchParams();
    if (_state.cat && _state.cat !== 'all') q.set('category', _state.cat);
    if (_state.maxPrice < 500)              q.set('max_price', _state.maxPrice);
    if (_state.organic && !_state.inorganic) q.set('product_type','organic');
    if (_state.inorganic && !_state.organic) q.set('product_type','inorganic');
    if (_state.farmer)   q.set('farmer_name', _state.farmer);
    if (_state.location) q.set('location',    _state.location);
    if (_state.sort)     q.set('sort',         _state.sort);
    if (_state.search)   q.set('search',       _state.search);
    q.set('page',  page);
    q.set('limit', 12);

    try {
      const data = await apiFetch('/products?' + q.toString());
      if (!data?.products?.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">🌾</div>
          <h3 data-i18n="no_results">${t('no_results') || 'No products found'}</h3>
          <p data-i18n="no_results_sub">${t('no_results_sub') || 'Try adjusting your filters.'}</p>
          <button class="btn btn-secondary" onclick="clearFilters()">Clear Filters</button>
        </div>`;
        if (countEl) countEl.textContent = '0 products';
        return;
      }
      window._pCache = window._pCache || {};
      data.products.forEach(p => { window._pCache[p.id] = p; });
      grid.innerHTML = data.products.map(renderProductCard).join('');
      if (countEl) countEl.textContent = data.total + ' products';
      _state.totalPages = data.pages;
      _renderPagination();
      translatePage();
    } catch (e) {
      console.error('Load products error:', e);
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400)">
        <b>Failed to load products</b><br>
        <small>${e.message || e}</small><br>
        <button class="btn btn-sm btn-ghost mt-16" onclick="_load(1)">Retry</button>
      </div>`;
      if (countEl) countEl.textContent = 'Error loading';
    }
  }

  function _renderPagination() {
    const el = document.getElementById('pagination');
    if (!el) return;
    if (_state.totalPages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML = Array.from({length: _state.totalPages}, (_, i) => i+1)
      .map(n => `<button class="btn ${n === _state.page ? 'btn-primary' : 'btn-ghost'} btn-sm"
          onclick="_load(${n})">${n}</button>`).join('');
  }

  async function _showFarmersSection() {
    const layout = document.querySelector('.sidebar-layout');
    if (layout) layout.classList.add('full-width');

    document.getElementById('listingSection').style.display = 'none';
    document.getElementById('pageHeaderBar').style.display = 'none';
    document.getElementById('productDetail').style.display = 'none';
    document.getElementById('marketSection').style.display = 'none';
    
    const sidebar = document.getElementById('sharedSidebar');
    if (sidebar) {
      sidebar.style.display = 'none';
      sidebar.classList.remove('open');
    }
    const mobileToggle = document.getElementById('mobileFilterToggle');
    if (mobileToggle) mobileToggle.style.display = 'none';

    const farmersSection = document.getElementById('farmersSection');
    if (farmersSection) farmersSection.style.display = 'block';
    document.title = 'Our Farmers — AgriDirect';

    const priceFilter = document.getElementById('filterPriceRange');
    if (priceFilter) priceFilter.style.display = 'none';
    const typeFilter = document.getElementById('filterProductType');
    if (typeFilter) typeFilter.style.display = 'none';

    const grid = document.getElementById('farmersSectionGrid');
    if (!grid) return;

    try {
      const data = await apiFetch('/farmers');
      _allSectionFarmers = data?.farmers || [];
      
      if (!_allSectionFarmers.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400)">
          <div style="font-size:2.5rem;margin-bottom:12px">🌾</div>
          <h4 style="color:var(--gray-500)">No farmers registered yet</h4>
          <p class="text-muted mt-8">Be the first farmer to join AgriDirect!</p>
        </div>`;
        return;
      }
      _renderSectionFarmers();
    } catch(e) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:28px;color:var(--gray-400)">Could not load farmers</div>';
    }
  }

  function _renderSectionFarmers() {
    const grid = document.getElementById('farmersSectionGrid');
    if (!grid) return;

    const farmerGradients = [
      'linear-gradient(135deg,var(--green-500),var(--green-800))',
      'linear-gradient(135deg,#68c48a,#1e4d35)',
      'linear-gradient(135deg,#f59e0b,#7c5200)',
      'linear-gradient(135deg,#60a5fa,#1e40af)',
      'linear-gradient(135deg,#f472b6,#9d174d)',
      'linear-gradient(135deg,#a78bfa,#5b21b6)',
    ];

    let items = _allSectionFarmers;
    if (_state.farmer) {
      items = items.filter(f => f.name.toLowerCase().includes(_state.farmer.toLowerCase()));
    }
    if (_state.location) {
      items = items.filter(f => (f.location || '').toLowerCase().includes(_state.location.toLowerCase()));
    }

    if (!items.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400)">No farmers found matching filters</div>`;
      return;
    }

    grid.innerHTML = items.map((f, i) => {
      const fullPhotoUrl = f.profile_photo;
      const verifiedBadge = f.is_verified ? `<div class="verified-badge" title="Verified Farmer">✔</div>` : '';
      const avatarInner = fullPhotoUrl 
        ? `<img src="${fullPhotoUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.parentElement.innerHTML='${(f.name || 'F')[0].toUpperCase()}'">`
        : (f.name || 'F')[0].toUpperCase();
      const avatarStyle = fullPhotoUrl ? `background:var(--gray-100)` : `background:${farmerGradients[i % farmerGradients.length]}`;

      return `
      <div class="farmer-card">
        <div style="position:relative;width:fit-content;margin:0 auto">
          <div class="farmer-avatar-lg" style="${avatarStyle}">${avatarInner}</div>
          ${verifiedBadge}
        </div>
        <div class="farmer-card-name">${f.name}</div>
        ${f.farm_name ? `<div class="text-sm text-muted" style="margin-bottom:4px">🌾 ${f.farm_name}</div>` : ''}
        <div class="farmer-card-loc">📍 ${f.location || 'Tamil Nadu'}</div>
        ${f.bio ? `<p class="text-sm text-muted" style="margin:8px 0;text-align:center;line-height:1.5">${f.bio}</p>` : ''}
        <div class="stars" style="justify-content:center;margin-bottom:8px">${f.avg_rating ? '★'.repeat(Math.round(f.avg_rating)) + '☆'.repeat(5 - Math.round(f.avg_rating)) : '<span class="text-muted text-sm">No ratings yet</span>'}</div>
        <div class="farmer-stats-row">
          <div><div class="f-stat-num">${f.products_count || 0}</div><div class="f-stat-label">Products</div></div>
          <div><div class="f-stat-num">${f.avg_rating ? f.avg_rating + '★' : '—'}</div><div class="f-stat-label">Rating</div></div>
          <div><div class="f-stat-num">${f.reviews_count || 0}</div><div class="f-stat-label">Reviews</div></div>
        </div>
      </div>`;
    }).join('');
    translatePage();
  }

  async function _showMarketSection() {
    const layout = document.querySelector('.sidebar-layout');
    if (layout) layout.classList.add('full-width');

    document.getElementById('listingSection').style.display = 'none';
    document.getElementById('pageHeaderBar').style.display = 'none';
    document.getElementById('productDetail').style.display = 'none';
    document.getElementById('farmersSection').style.display = 'none';
    
    const sidebar = document.getElementById('sharedSidebar');
    if (sidebar) {
      sidebar.style.display = 'none';
      sidebar.classList.remove('open');
    }
    const mobileToggle = document.getElementById('mobileFilterToggle');
    if (mobileToggle) mobileToggle.style.display = 'none';

    const marketSection = document.getElementById('marketSection');
    if (marketSection) marketSection.style.display = 'block';
    document.title = 'Market Prices — AgriDirect';

    const priceFilter = document.getElementById('filterPriceRange');
    if (priceFilter) priceFilter.style.display = 'none';
    const typeFilter = document.getElementById('filterProductType');
    if (typeFilter) typeFilter.style.display = 'none';

    const tbody = document.getElementById('marketPriceBody');
    if (!tbody) return;

    const district = _state.location || '';
    const category = _state.cat !== 'all' ? _state.cat : '';

    try {
      let url = '/market-prices';
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (district) {
        const dData = await apiFetch('/market-prices/districts');
        const dMatch = (dData?.districts || []).find(d => d.name.toLowerCase().includes(district.toLowerCase()));
        if (dMatch) params.set('district_id', dMatch.id);
      }
      
      const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
      const data = await apiFetch(fullUrl);
      
      if (!data?.prices?.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--gray-400)">No market prices available</td></tr>';
        return;
      }
      tbody.innerHTML = data.prices.map(p => {
        const changeColor = p.change_pct > 0 ? 'var(--red-500)' : p.change_pct < 0 ? 'var(--green-600)' : 'var(--gray-500)';
        const changeIcon = p.change_pct > 0 ? '▲' : p.change_pct < 0 ? '▼' : '—';
        return `<tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:34px;height:34px;border-radius:8px;background:var(--green-50);display:flex;align-items:center;justify-content:center;font-size:1.1rem">${getCategoryEmoji(p.category)}</div>
              <div>
                <div class="fw-600">${p.name}</div>
                ${p.name_ta ? `<div class="text-xs text-muted">${p.name_ta}</div>` : ''}
              </div>
            </div>
          </td>
          <td style="text-transform:capitalize">${p.category}</td>
          <td class="fw-600" style="color:var(--green-700)">₹${p.price}/kg</td>
          <td>
            <span style="color:${changeColor};font-weight:600;font-size:.85rem">
              ${changeIcon} ${Math.abs(p.change_pct)}%
            </span>
          </td>
          <td class="text-sm">${p.district_name || '—'}</td>
          <td class="text-sm">${p.market || '—'}</td>
          <td class="text-sm text-muted">${p.updated_at ? fmtDate(p.updated_at) : 'Today'}</td>
        </tr>`;
      }).join('');
      translatePage();
    } catch(e) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--gray-400)">Failed to load market prices</td></tr>';
    }
  }

  async function _loadDetail(id) {
    const layout = document.querySelector('.sidebar-layout');
    if (layout) layout.classList.add('full-width');
    
    const sidebar = document.getElementById('sharedSidebar');
    if (sidebar) {
      sidebar.style.display = 'none';
      sidebar.classList.remove('open');
    }
    const mobileToggle = document.getElementById('mobileFilterToggle');
    if (mobileToggle) mobileToggle.style.display = 'none';
    const listingSec = document.getElementById('listingSection');
    if (listingSec) listingSec.style.display = 'none';
    const farmersSec = document.getElementById('farmersSection');
    if (farmersSec) farmersSec.style.display = 'none';
    const marketSec = document.getElementById('marketSection');
    if (marketSec) marketSec.style.display = 'none';
    const pageHeader = document.getElementById('pageHeaderBar');
    if (pageHeader) {
      pageHeader.style.display = 'block';
      // Header stays as "Products" with its own breadcrumb
    }

    const detail = document.getElementById('productDetail');
    if (!detail) return;
    detail.style.display = 'block';

    try {
      const p = await apiFetch(`/products/${id}`);
      window._pCache = window._pCache || {};
      window._pCache[p.id] = p;
      const name = currentLang === 'ta' ? (p.name_ta || p.name) : p.name;
      document.title = name + ' — AgriDirect';

      const imgs  = p.images?.length ? p.images : [];
      const hasMP = !!p.market_price;
      const diff  = hasMP ? ((p.price - p.market_price)/p.market_price*100).toFixed(1) : null;

      detail.innerHTML = `
        <div class="product-detail-container container">
          <div class="breadcrumb mb-24" style="color:var(--gray-400); font-size:0.85rem">
            <a href="index.html">Home</a><span style="margin:0 8px">›</span>
            <a href="products.html">Products</a><span style="margin:0 8px">›</span>
            <span class="text-muted">${name}</span>
          </div>

          <div class="product-detail-grid">
            <div class="detail-img-col">
              <div class="detail-main-img" onclick="zoomImg('${imgs[0]?getFullImageUrl(imgs[0]):''}')">
                <div class="product-card-slider" id="detailSlider" onscroll="updateDetailSliderDots(this)">
                  ${imgs.length > 0
                    ? imgs.map(img => `<img src="${getFullImageUrl(img)}" alt="${name}">`).join('')
                    : `<div class="placeholder">${getCategoryEmoji(p.category)}</div>`}
                </div>
                ${imgs.length > 1 ? `
                  <button class="slider-arrow prev" onclick="event.stopPropagation();moveDetailSlider(-1)">❮</button>
                  <button class="slider-arrow next" onclick="event.stopPropagation();moveDetailSlider(1)">❯</button>
                ` : ''}
                <div class="zoom-btn">🔍 Zoom</div>
              </div>
              ${imgs.length > 1 ? `<div class="detail-thumbs" id="detailThumbs">${imgs.map((u,i)=>`<div class="detail-thumb ${i===0?'active':''}" onclick="switchDetailImg(${i},this)"><img src="${getFullImageUrl(u)}" alt=""></div>`).join('')}</div>` : ''}
            </div>

            <div class="detail-info-col">
              <div class="detail-category-caps">${p.category.toUpperCase()}</div>
              <h1 class="detail-title-bold">${name}</h1>
              
              <div class="detail-badges-row">
                <span class="badge-rounded badge-organic">🌱 ${t('organic')}</span>
                <span class="badge-rounded badge-instock">${p.quantity > 0 ? t('in_stock') : t('out_of_stock')}</span>
              </div>

              <div class="detail-price-box-new">
                <div class="price-main-row">
                  <span class="currency">₹</span><span class="amount">${p.price}</span><span class="unit"> /${t(p.category === 'Dairy' ? 'liter' : p.unit)}</span>
                </div>
                ${hasMP ? `
                <div class="market-info-row">
                  <span class="market-price-text">Market: ₹${p.market_price}/kg</span>
                  <span class="market-rate-badge">Market Rate</span>
                  <span class="price-diff ${+diff < 0 ? 'down' : 'up'}">
                    ${+diff < 0 ? '▼ ' + Math.abs(diff) + '% below market' : '▲ ' + diff + '% above market'}
                  </span>
                </div>` : ''}
                <div class="price-updated-text">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top:-2px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  ${t('price_changed')} ${fmtDateTime(p.price_updated_at || new Date())}
                </div>
              </div>

              <div class="qty-section">
                <div class="qty-label">Available Quantity</div>
                <div class="qty-row-new">
                  <div class="qty-stepper">
                    <button onclick="detailQty(-1)">−</button>
                    <input type="number" id="detailQtyInput" value="1" min="1" max="${p.quantity}">
                    <button onclick="detailQty(1)">+</button>
                  </div>
                  <div class="qty-available-text">${p.quantity} ${t(p.category === 'Dairy' ? 'liter' : p.unit)} ${t('available')}</div>
                </div>
              </div>

              <div class="detail-actions-row">
                <button class="btn-add-cart-large" onclick="detailAddToCart(${p.id})" ${p.quantity<=0?'disabled':''}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  ${t('add_to_cart')}
                </button>
                <button class="btn-wishlist-round" onclick="toggleWishlist(${p.id},this)">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </button>
              </div>

              <div class="specs-grid-new">
                <div class="spec-box">
                  <div class="label">HARVESTED</div>
                  <div class="value">${fmtDate(p.harvest_date || new Date())}</div>
                </div>
                <div class="spec-box">
                  <div class="label">CATEGORY</div>
                  <div class="value" style="text-transform:capitalize">${p.category}</div>
                </div>
                <div class="spec-box">
                  <div class="label">PRODUCT TYPE</div>
                  <div class="value" style="text-transform:capitalize">${p.product_type}</div>
                </div>
                <div class="spec-box">
                  <div class="label">UNIT</div>
                  <div class="value" style="text-transform:capitalize">${p.category === 'Dairy' ? 'liter' : p.unit}</div>
                </div>
              </div>

              ${p.description ? `<div style="margin-top:8px"><div class="qty-label mb-8">${t('description')}</div><p style="font-size:0.95rem; line-height:1.6; color:var(--gray-600)">${p.description}</p></div>` : ''}
              
              <div class="detail-farmer-box mt-8">
                <div class="farmer-avatar-lg" style="flex-shrink:0; width:52px; height:52px; font-size:1.2rem; margin:0">${(p.farmer_name||'F')[0]}</div>
                <div style="flex:1">
                  <div class="fw-700 text-lg">${p.farmer_name||'—'}</div>
                  ${p.farmer_farm?`<div class="text-sm text-muted">${p.farmer_farm}</div>`:''}
                </div>
                <button class="btn btn-ghost btn-sm" onclick="location.href='products.html?section=farmers&search=${encodeURIComponent(p.farmer_name||'')}'">View Profile</button>
              </div>
            </div>
          </div>
          <div id="reviewsSection" style="margin-top:64px; border-top:1px solid var(--gray-100); padding-top:48px"></div>
        </div>`;

      _loadReviews(id);
    } catch { detail.innerHTML = '<div class="empty-state"><div class="empty-icon">😕</div><h3>Product not found</h3><a href="products.html" class="btn btn-primary mt-16">Browse Products</a></div>'; }
  }

  async function _loadReviews(productId) {
    const sec = document.getElementById('reviewsSection');
    if (!sec) return;
    try {
      const data = await apiFetch(`/products/${productId}/reviews`);
      const reviews = data?.reviews || [];
      let html = '';
      if (reviews.length) {
        const avg = reviews.reduce((s,r)=>s+r.overall_service,0)/reviews.length;
        html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px"><h3>Customer Reviews</h3><div style="display:flex;align-items:center;gap:10px"><div class="stars">${renderStars(avg)}</div><span class="fw-600">${avg.toFixed(1)} / 5</span><span class="text-muted text-sm">(${data.total} reviews)</span></div></div>` +
          reviews.map(r=>`<div class="review-item"><div class="review-head"><div class="farmer-avatar-sm" style="width:32px;height:32px;font-size:.85rem">${(r.customer_name||'C')[0]}</div><div><div class="fw-600 text-sm">${r.customer_name}</div><div class="stars" style="font-size:.78rem">${renderStars(r.overall_service)}</div></div><div class="review-date">${fmtDate(r.created_at)}</div></div><div style="display:flex;gap:14px;font-size:.75rem;color:var(--gray-500);margin-bottom:7px"><span>Quality: <b>${r.product_quality}/5</b></span><span>Delivery: <b>${r.delivery_time}/5</b></span><span>Service: <b>${r.overall_service}/5</b></span></div>${r.comment?`<p class="review-text">${r.comment}</p>`:''}</div>`).join('');
      } else {
        html = '<p class="text-muted text-sm mb-24">No reviews yet. Be the first to review!</p>';
      }
      if (Auth.isLoggedIn() && Auth.user.role === 'customer') {
        html += `<div class="card mt-32" style="background:var(--gray-50)"><div class="card-body"><h4 class="mb-16">Write a Review</h4><div class="form-grid mb-16"><div class="form-group"><label class="form-label">Product Quality (1-5)</label><input type="number" id="revQuality" class="form-input" min="1" max="5" value="5"></div><div class="form-group"><label class="form-label">Delivery Speed (1-5)</label><input type="number" id="revDelivery" class="form-input" min="1" max="5" value="5"></div><div class="form-group"><label class="form-label">Overall Service (1-5)</label><input type="number" id="revService" class="form-input" min="1" max="5" value="5"></div></div><div class="form-group mb-16"><label class="form-label">Your Comment</label><textarea id="revComment" class="form-input" rows="3" placeholder="Tell others about your experience..."></textarea></div><button class="btn btn-primary" onclick="submitReview(${productId})">Submit Review</button></div></div>`;
      } else if (!Auth.isLoggedIn()) {
        html += `<div class="mt-32 text-center p-24 border-dashed rounded-xl"><p class="text-muted text-sm">Please <a href="#" onclick="openAuthModal();return false" class="text-green fw-600">login as a customer</a> to write a review.</p></div>`;
      }
      sec.innerHTML = html;
    } catch {}
  }

  function _initSidebar() {
    document.querySelectorAll('#catChips .chip').forEach(c => {
      c.onclick = () => {
        document.querySelectorAll('#catChips .chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        _state.cat = c.dataset.cat;
        _load(1);
      };
      if (c.dataset.cat === _state.cat) c.classList.add('active');
    });
    const priceSlider = document.getElementById('maxPriceSlider');
    if (priceSlider) {
      priceSlider.oninput = function() {
        const valEl = document.getElementById('maxPriceVal');
        if (valEl) valEl.textContent = this.value;
        _state.maxPrice = +this.value;
      };
    }
    if (_state.search) {
      const inp = document.getElementById('filterSearch');
      if (inp) inp.value = _state.search;
    }
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.onchange = () => {
        _state.sort = sortSelect.value;
        _load(1);
      };
    }
  }

  /* ── 2. Expose global functions ── */

  window.applyFilters = function() {
    _state.organic   = document.getElementById('chkOrganic')?.checked;
    _state.inorganic = document.getElementById('chkInorganic')?.checked;
    _state.farmer    = document.getElementById('filterFarmer')?.value.trim();
    _state.location  = document.getElementById('filterLocation')?.value.trim();
    _state.sort      = document.getElementById('sortSelect')?.value || 'newest';
    _state.search    = document.getElementById('filterSearch')?.value.trim();

    const farmersVisible = document.getElementById('farmersSection')?.style.display === 'block';
    const marketVisible  = document.getElementById('marketSection')?.style.display === 'block';

    if (farmersVisible) _renderSectionFarmers();
    else if (marketVisible) _showMarketSection();
    else _load(1);
  };

  window.clearFilters = function() {
    _state = { ..._state, cat:'all', maxPrice:500, organic:false, inorganic:false,
                farmer:'', location:'', sort:'newest', search:'' };
    document.querySelectorAll('#catChips .chip').forEach(c => c.classList.toggle('active', c.dataset.cat==='all'));
    const priceSlider = document.getElementById('maxPriceSlider');
    if (priceSlider) priceSlider.value = 500;
    const priceVal = document.getElementById('maxPriceVal');
    if (priceVal) priceVal.textContent = '500';
    ['chkOrganic','chkInorganic'].forEach(id => { const el = document.getElementById(id); if(el) el.checked=false; });
    ['filterFarmer','filterLocation','filterSearch'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = 'newest';
    window.applyFilters();
  };

  window.submitReview = async function(productId) {
    const q = parseInt(document.getElementById('revQuality').value);
    const d = parseInt(document.getElementById('revDelivery').value);
    const s = parseInt(document.getElementById('revService').value);
    const c = document.getElementById('revComment').value.trim();
    if (!q || !d || !s) { showToast('Please provide all ratings', 'error'); return; }
    try {
      await apiFetch('/reviews', 'POST', { product_id: productId, product_quality: q, delivery_time: d, overall_service: s, comment: c });
      showToast('Review submitted successfully!', 'success');
      _loadReviews(productId);
    } catch (e) { showToast(e.message || 'Failed to submit review', 'error'); }
  };

  window.detailQty = (delta) => {
    const inp = document.getElementById('detailQtyInput');
    if (!inp) return;
    let val = (parseInt(inp.value) || 1) + delta;
    const max = parseInt(inp.getAttribute('max')) || 999;
    if (val < 1) val = 1;
    if (val > max) val = max;
    inp.value = val;
  };

  window.detailAddToCart = (id) => {
    if (!Auth.isLoggedIn()) { openAuthModal(); return; }
    const p = window._pCache?.[id]; if (!p) return;
    const qty = +document.getElementById('detailQtyInput')?.value || 1;
    Cart.add(p, qty);
    openCart();
  };

  window.switchDetailImg = (index, el) => {
    const slider = document.getElementById('detailSlider');
    if (slider) { slider.scrollTo({ left: slider.offsetWidth * index, behavior: 'smooth' }); }
    document.querySelectorAll('.detail-thumb').forEach(t=>t.classList.remove('active'));
    el.classList.add('active');
  };

  window.moveDetailSlider = (dir) => {
    const slider = document.getElementById('detailSlider');
    if (slider) { slider.scrollBy({ left: slider.offsetWidth * dir, behavior: 'smooth' }); }
  };

  window.updateDetailSliderDots = (el) => {
    const index = Math.round(el.scrollLeft / el.offsetWidth);
    const thumbs = document.querySelectorAll('.detail-thumb');
    thumbs.forEach((thumb, i) => thumb.classList.toggle('active', i === index));
  };

  window.zoomImg = (src) => {
    if (!src) return;
    const zoom = document.getElementById('zoomImg');
    if (zoom) zoom.src = src;
    document.getElementById('zoomOverlay')?.classList.add('open');
  };

  /* ── 3. Initialize page based on URL ── */
  const _up = new URLSearchParams(window.location.search);
  if (_up.get('cat'))    _state.cat    = _up.get('cat');
  if (_up.get('search')) _state.search = _up.get('search');
  
  const _section = _up.get('section');
  _initSidebar(); 

  if (_section === 'farmers') {
    _showFarmersSection();
  } else if (_section === 'market') {
    _showMarketSection();
  } else if (_up.get('id')) {
    _loadDetail(_up.get('id'));
  } else {
    _load(1);
  }
}
