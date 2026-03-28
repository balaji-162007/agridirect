/* ============================================================
   cart.js  –  Cart state, drawer UI, totals
   ============================================================ */

window.Cart = {
  items: [],

  init() {
    const loggedIn = !!localStorage.getItem('agri_token');
    if (!loggedIn) {
      this.items = [];
      localStorage.removeItem('agri_cart');
    } else {
      this.items = JSON.parse(localStorage.getItem('agri_cart') || '[]');
    }
    this._updateBadge();
  },

  add(product, qty = 1) {
    const idx = this.items.findIndex(i => i.product_id === product.id);
    if (idx > -1) {
      this.items[idx].qty = Math.min(this.items[idx].qty + qty, product.quantity || 9999);
    } else {
      this.items.push({
        product_id:   product.id,
        name:         product.name,
        name_ta:      product.name_ta || product.name,
        price:        product.price,
        unit:         product.unit || 'kg',
        farmer_id:    product.farmer_id || 0,
        farmer_name:  product.farmer_name || '',
        image:        product.images?.[0] || '',
        qty,
        max_qty: product.quantity || 9999,
      });
    }
    this._save();
    this._updateBadge();
    drawCartDrawer();
  },

  remove(productId) {
    this.items = this.items.filter(i => i.product_id !== productId);
    this._save();
    this._updateBadge();
    drawCartDrawer();
  },

  updateQty(productId, delta) {
    const item = this.items.find(i => i.product_id === productId);
    if (!item) return;
    const newQty = item.qty + delta;
    this.setQty(productId, newQty);
  },

  setQty(productId, qty) {
    const item = this.items.find(i => i.product_id === productId);
    if (!item) return;
    
    qty = parseInt(qty);
    if (isNaN(qty) || qty <= 0) {
      this.remove(productId);
      return;
    }

    const max = item.max_qty || 9999;
    item.qty = Math.min(qty, max);
    
    this._save();
    this._updateBadge();
    
    if (typeof drawCartDrawer === 'function') drawCartDrawer();
  },

  subtotal() { return this.items.reduce((s, i) => s + i.price * i.qty, 0); },
  count()    { return this.items.reduce((s, i) => s + i.qty, 0); },
  clear()    { this.items = []; this._save(); this._updateBadge(); drawCartDrawer(); },

  _save()        { 
    localStorage.setItem('agri_cart', JSON.stringify(this.items)); 
    document.dispatchEvent(new CustomEvent('cartUpdated'));
  },
  _updateBadge() {
    const n = this.count();
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent = n;
      el.style.display = n > 0 ? 'flex' : 'none';
    });
  },
};

/* ── Open / Close drawer ── */
window.openCart = function() {
  if (!Auth.isLoggedIn()) { openAuthModal(); return; }
  document.getElementById('cartBackdrop')?.classList.add('open');
  document.getElementById('cartDrawer')?.classList.add('open');
  drawCartDrawer();
};
window.closeCart = function() {
  document.getElementById('cartBackdrop')?.classList.remove('open');
  document.getElementById('cartDrawer')?.classList.remove('open');
};

/* ── Render drawer ── */
window.drawCartDrawer = function() {
  const itemsEl  = document.getElementById('cartItemsList');
  const footerEl = document.getElementById('cartDrawerFooter');
  if (!itemsEl) return;

  if (!Cart.items.length) {
    itemsEl.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon">🛒</div>
        <p class="fw-600" data-i18n="cart_empty">${t('cart_empty')}</p>
        <p class="text-muted text-sm mt-8" data-i18n="cart_empty_sub">${t('cart_empty_sub')}</p>
      </div>`;
    if (footerEl) footerEl.style.display = 'none';
    return;
  }

  if (footerEl) footerEl.style.display = 'block';
  const useTa = currentLang === 'ta';

  itemsEl.innerHTML = Cart.items.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.image ? `<img src="${getFullImageUrl(item.image)}" style="width:100%;height:100%;object-fit:cover">` : getCategoryEmoji()}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${useTa ? item.name_ta : item.name}</div>
        <div class="cart-item-meta">${item.farmer_name}</div>
        <div class="cart-item-price">₹${item.price}${t(item.unit === 'kg' ? 'per_kg' : 'per_unit')}</div>
        <div class="flex items-center gap-8 mt-8">
          <div class="qty-control" style="transform:scale(.82);transform-origin:left">
            <button class="qty-btn" onclick="Cart.updateQty(${item.product_id},-1)">−</button>
            <input class="qty-input" type="number" value="${item.qty}" min="1" max="${item.max_qty || 9999}"
              onchange="Cart.setQty(${item.product_id},this.value)">
            <button class="qty-btn" onclick="Cart.updateQty(${item.product_id},1)">+</button>
          </div>
          <span class="fw-600 text-green">₹${(item.price * item.qty).toFixed(2)}</span>
        </div>
      </div>
      <button class="cart-item-del" onclick="Cart.remove(${item.product_id})" title="Remove">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>`).join('');

  /* totals */
  const sub      = Cart.subtotal();
  const delCharge = sub > 500 ? 0 : 40;
  const grand    = sub + delCharge;
  const totalsEl = document.getElementById('cartTotals');
  if (totalsEl) {
    totalsEl.innerHTML = `
      <div class="cart-total-row"><span data-i18n="subtotal">${t('subtotal')}</span><span>₹${sub.toFixed(2)}</span></div>
      <div class="cart-total-row"><span data-i18n="delivery">${t('delivery')}</span>
        <span>${delCharge === 0 ? t('free') : '₹'+delCharge}</span></div>
      <div class="cart-total-row grand"><span data-i18n="total">${t('total')}</span><span class="text-green">₹${grand.toFixed(2)}</span></div>`;
  }
}

/* ── Add-to-cart handler used from product cards ── */
async function handleAddToCart(productId, btn) {
  if (!Auth.isLoggedIn()) { openAuthModal(); return; }

  /* try cache first */
  let product = window._pCache?.[productId];
  if (!product) {
    try {
      product = await apiFetch(`/products/${productId}`);
      if (!window._pCache) window._pCache = {};
      window._pCache[productId] = product;
    } catch { showToast('Could not add item', 'error'); return; }
  }

  Cart.add(product);
  showToast(t('added'), 'success', '🛒');

  /* brief button feedback */
  if (btn) {
    btn.innerHTML = '✓';
    btn.style.background = 'var(--green-500)';
    setTimeout(() => {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      btn.style.background = '';
    }, 1200);
  }
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  Cart.init();
  document.getElementById('cartBackdrop')?.addEventListener('click', closeCart);
});
