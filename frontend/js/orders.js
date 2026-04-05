/* ============================================================
   orders.js  –  Checkout flow, order tracking, reviews
   ============================================================ */

/* ============================================================
   CHECKOUT  (cart.html → checkout.html)
   ============================================================ */
if (document.getElementById('checkoutLayout')) {
  let _delivery = 'farmer_delivery';
  let _payment  = 'cod';
  let _onlineMode = 'upi';
  let _farmerSettings = null;
  let _calculatedFarmerDelCost = 0;
  let _calculatedLocalDelCost = 0;
  let _isFarmerDelEligible = true;
  let _isLocalDelEligible = true;

  /* render cart summary */
  async function renderCheckoutSummary() {
    const list = document.getElementById('orderSumList');
    if (!list) return;
    if (!Cart.items.length) { window.location.href = 'cart.html'; return; }

    const useTa = currentLang === 'ta';
    list.innerHTML = Cart.items.map(item => `
      <div class="order-sum-item">
        <div>
          <div class="order-sum-name">${useTa ? item.name_ta : item.name}</div>
          <div class="order-sum-qty">${item.qty} ${item.category === 'Dairy' ? 'liter' : item.unit} × ₹${item.price}</div>
        </div>
        <div class="order-sum-price">₹${(item.price * item.qty).toFixed(2)}</div>
      </div>`).join('');

    /* fetch farmer settings if not already loaded */
    const farmerId = Cart.items[0]?.farmer_id;
    if (farmerId && !_farmerSettings) {
      try {
        const data = await API.getFarmerProfile(farmerId);
        _farmerSettings = data?.farmer || null;
        _recalculateFarmerDelivery();
        _recalculateLocalDelivery();
      } catch (e) { console.error('Farmer settings error:', e); }
    }

    _recalculateFarmerDelivery();
    _recalculateLocalDelivery();
    _updateTotals();

    /* prefill name / phone */
    if (Auth.user) {
      document.getElementById('addrName').value  = Auth.user.name  || '';
      document.getElementById('addrPhone').value = (Auth.user.phone || '').replace('+91','');
    }
  }

  function _updateTotals() {
    const sub  = Cart.subtotal();
    let del = 0;
    
    if (_delivery === 'local_partner') {
      del = _calculatedLocalDelCost;
    } else if (_delivery === 'farmer_delivery') {
      del = _calculatedFarmerDelCost;
    }
    
    const grand = sub + del;
    document.getElementById('sumSubtotal').textContent = '₹' + sub.toFixed(2);
    document.getElementById('sumDelivery').textContent = del === 0 ? t('free') : '₹' + del.toFixed(2);
    document.getElementById('sumTotal').textContent    = '₹' + grand.toFixed(2);
  }

  /* Location helper with Auto-fill Address */
  window.getUserCoordinates = function() {
    const feedback = document.getElementById('coordsFeedback');
    if (!navigator.geolocation) {
      feedback.textContent = 'Geolocation not supported by your browser.';
      feedback.style.color = 'var(--red-500)';
      return;
    }
    feedback.textContent = '⌛ Fetching coordinates and address...';
    feedback.style.color = 'var(--gray-500)';
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        document.getElementById('addrLat').value = lat;
        document.getElementById('addrLng').value = lng;
        
        try {
          // Reverse geocode using OpenStreetMap (Nominatim)
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'User-Agent': 'AgriDirect-App' }
          });
          const data = await res.json();
          
          if (data && data.address) {
            const addr = data.address;
            
            // Map address fields to inputs
            const line1Parts = [];
            if (addr.road) line1Parts.push(addr.road);
            if (addr.suburb) line1Parts.push(addr.suburb);
            if (addr.neighbourhood) line1Parts.push(addr.neighbourhood);
            
            const line1El = document.getElementById('addrLine1');
            if (line1El) line1El.value = line1Parts.join(', ') || addr.amenity || '';
            
            const cityEl = document.getElementById('addrCity');
            if (cityEl) cityEl.value = addr.city || addr.town || addr.village || addr.county || '';
            
            const stateEl = document.getElementById('addrState');
            if (stateEl) {
              // Try to find matching state in select
              const stateName = addr.state || '';
              for (let i = 0; i < stateEl.options.length; i++) {
                if (stateEl.options[i].text.toLowerCase() === stateName.toLowerCase() || 
                    stateEl.options[i].value.toLowerCase() === stateName.toLowerCase()) {
                  stateEl.selectedIndex = i;
                  break;
                }
              }
            }
            
            const pinEl = document.getElementById('addrPin');
            if (pinEl) pinEl.value = addr.postcode || '';

            feedback.textContent = `✅ Location and address captured automatically!`;
            feedback.style.color = 'var(--green-700)';
          } else {
            feedback.textContent = `✅ Coordinates captured: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            feedback.style.color = 'var(--green-700)';
          }
        } catch (e) {
          console.error('Reverse geocode error:', e);
          feedback.textContent = `✅ Coordinates captured: ${lat.toFixed(4)}, ${lng.toFixed(4)} (Address failed)`;
          feedback.style.color = 'var(--green-700)';
        }
        
        // Re-calculate delivery if on step 2
        _recalculateFarmerDelivery();
        _recalculateLocalDelivery();
      },
      (err) => {
        feedback.textContent = '❌ Could not get location. Please enter address manually.';
        feedback.style.color = 'var(--red-500)';
      }
    );
  };

  function _recalculateFarmerDelivery() {
    if (!_farmerSettings) return;
    
    const lat1 = _farmerSettings.latitude;
    const lng1 = _farmerSettings.longitude;
    const lat2 = parseFloat(document.getElementById('addrLat').value);
    const lng2 = parseFloat(document.getElementById('addrLng').value);
    
    const msgEl = document.getElementById('deliveryEligibilityMsg');
    const optEl = document.getElementById('opt-farmer_delivery');
    const costEl = document.getElementById('farmerDelCost');
    const descEl = document.getElementById('farmerDelDesc');

    if (isNaN(lat2) || isNaN(lng2)) {
      _isFarmerDelEligible = false;
      _calculatedFarmerDelCost = 0;
      msgEl.innerHTML = `<div class="p-12 bg-amber-50 text-amber-700 text-sm border-rounded" style="border-radius:var(--radius-md); border:1px solid var(--amber-100)">📍 Please <b>Get Your Location</b> above to check eligibility for Farmer Self Delivery.</div>`;
      msgEl.style.display = 'block';
      optEl.classList.add('disabled');
      optEl.style.opacity = '0.5';
      optEl.style.pointerEvents = 'none';
      costEl.textContent = '—';
      if (_delivery === 'farmer_delivery') selectDelivery('local_partner');
      return;
    }

    // Validate farmer coordinates (ensure not 0,0 or undefined)
    if (!lat1 || !lng1 || (Math.abs(lat1) < 0.1 && Math.abs(lng1) < 0.1)) {
      _isFarmerDelEligible = false;
      _calculatedFarmerDelCost = 0;
      msgEl.innerHTML = `<div class="p-12 bg-amber-50 text-amber-700 text-sm border-rounded" style="border-radius:var(--radius-md); border:1px solid var(--amber-100)">⚠️ Farmer has not set their location yet. Self delivery is currently unavailable.</div>`;
      msgEl.style.display = 'block';
      optEl.classList.add('disabled');
      optEl.style.opacity = '0.5';
      optEl.style.pointerEvents = 'none';
      costEl.textContent = 'N/A';
      if (_delivery === 'farmer_delivery') selectDelivery('local_partner');
      return;
    }

    const dist = _calculateHaversine(lat1, lng1, lat2, lng2);
    const totalQty = Cart.items.reduce((s, i) => s + i.qty, 0);
    
    // Eligibility checks
    let error = '';
    const maxDist = _farmerSettings.max_delivery_distance || 10;
    const maxCap = 15; // Farmer self-delivery is limited to 15kg
    const allowedQty = maxCap * (1 - (dist / maxDist));
    
    if (totalQty > maxCap) {
      error = `<b>Reduce quantity to enable delivery</b><br>Order exceeds farmer's maximum carrying capacity (${maxCap} kg).`;
    } else if (dist > maxDist) {
      error = `<b>Delivery not available for this distance</b><br>Address is beyond farmer's maximum delivery distance (${maxDist} km).`;
    } else if (totalQty > allowedQty) {
      error = `<b>Reduce quantity to enable delivery</b><br>For your location (${dist.toFixed(1)} km), the maximum quantity allowed is <b>${allowedQty.toFixed(1)} kg</b>.<br><small>(Your current order: ${totalQty.toFixed(1)} kg)</small>`;
    }

    if (error) {
      _isFarmerDelEligible = false;
      _calculatedFarmerDelCost = 0;
      msgEl.innerHTML = `<div class="p-16 bg-red-50 text-red-700 text-sm border-rounded" style="border-radius:var(--radius-md); border:1px solid var(--red-100); line-height:1.5">${error}</div>`;
      msgEl.style.display = 'block';
      optEl.classList.add('disabled');
      optEl.style.opacity = '0.5';
      optEl.style.pointerEvents = 'none';
      if (_delivery === 'farmer_delivery') selectDelivery('local_partner');
    } else {
      _isFarmerDelEligible = true;
      // Standard Platform Delivery Rates
      const base = 20;
      const perKm = 5;
      const perKg = 2;
      _calculatedFarmerDelCost = base + (dist * perKm) + (totalQty * perKg);
      
      const allowedQtyAtDist = maxCap * (1 - (dist / maxDist));
      msgEl.innerHTML = `
        <div class="p-16 bg-green-50 text-green-700 text-sm border-rounded" style="border-radius:var(--radius-md); border:1px solid var(--green-100); line-height:1.5">
          <b>✅ Farmer delivery available!</b><br>
          Distance: <b>${dist.toFixed(1)} km</b> from farm.<br>
          Maximum quantity allowed for your location: <b>${allowedQtyAtDist.toFixed(1)} kg</b>.
        </div>`;
      msgEl.style.display = 'block';
      optEl.classList.remove('disabled');
      optEl.style.opacity = '1';
      optEl.style.pointerEvents = 'auto';
      costEl.textContent = '₹' + _calculatedFarmerDelCost.toFixed(2);
      descEl.textContent = `Standard Delivery Fee: ₹${base} + ₹${perKm}/km + ₹${perKg}/kg`;
    }
    _updateTotals();
  }

  function _recalculateLocalDelivery() {
    const lat2 = parseFloat(document.getElementById('addrLat').value);
    const lng2 = parseFloat(document.getElementById('addrLng').value);
    const totalQty = Cart.items.reduce((s, i) => s + i.qty, 0);

    const optEl = document.getElementById('opt-local_partner');
    const costEl = document.getElementById('localDelCost');
    const descEl = document.getElementById('localDelDesc');
    const msgEl = document.getElementById('deliveryEligibilityMsg'); // Reusing existing message area

    // Rule 1: Minimum Quantity
    const MIN_QTY = 10;
    if (totalQty < MIN_QTY) {
      _isLocalDelEligible = false;
      _calculatedLocalDelCost = 0;
      optEl.classList.add('disabled');
      optEl.style.opacity = '0.5';
      optEl.style.pointerEvents = 'none';
      costEl.textContent = '—';
      descEl.innerHTML = `<span class="text-red">⚠️ Add <b>${(MIN_QTY - totalQty).toFixed(1)} kg</b> more to unlock.</span>`;
      
      // If currently selected, switch away
      if (_delivery === 'local_partner') selectDelivery('pickup');
      return;
    }

    // Rule 2: Distance Check (Location required)
    if (isNaN(lat2) || isNaN(lng2)) {
      _isLocalDelEligible = false;
      _calculatedLocalDelCost = 0;
      optEl.classList.add('disabled');
      optEl.style.opacity = '0.5';
      optEl.style.pointerEvents = 'none';
      costEl.textContent = '—';
      return;
    }

    // Get distance from farmer (assuming first item's farmer)
    if (!_farmerSettings) return;
    const lat1 = _farmerSettings.latitude;
    const lng1 = _farmerSettings.longitude;
    const dist = _calculateHaversine(lat1, lng1, lat2, lng2);
    
    // Optional Max Distance Rule
    const MAX_DIST = 15;
    if (dist > MAX_DIST) {
      _isLocalDelEligible = false;
      _calculatedLocalDelCost = 0;
      optEl.classList.add('disabled');
      optEl.style.opacity = '0.5';
      optEl.style.pointerEvents = 'none';
      costEl.textContent = 'N/A';
      descEl.innerHTML = `<span class="text-red">❌ Beyond local delivery range (${dist.toFixed(1)} km).</span>`;
      if (_delivery === 'local_partner') selectDelivery('pickup');
      return;
    }

    // Rule 3: Calculation
    const BASE_FEE = 30;
    const PER_KM = 6;
    const PER_KG = 3;
    _calculatedLocalDelCost = BASE_FEE + (dist * PER_KM) + (totalQty * PER_KG);
    _isLocalDelEligible = true;

    // Update UI
    optEl.classList.remove('disabled');
    optEl.style.opacity = '1';
    optEl.style.pointerEvents = 'auto';
    costEl.textContent = '₹' + _calculatedLocalDelCost.toFixed(2);
    descEl.innerHTML = `Distance: <b>${dist.toFixed(1)} km</b> • Weight: <b>${totalQty.toFixed(1)} kg</b><br>
                        <small>₹${BASE_FEE} base + ₹${PER_KM}/km + ₹${PER_KG}/kg</small>`;
    
    _updateTotals();
  }

  function _calculateHaversine(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || isNaN(lat2) || isNaN(lon2)) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /* step navigation */
  window.goStep = function(n) {
    if (n === 2 && !_validateAddr()) return;
    if (n === 2) {
      _recalculateFarmerDelivery();
      _recalculateLocalDelivery();
    }
    if (n > 1) {
      const prevBadge = document.getElementById(`step${n-1}Num`);
      if (prevBadge) { prevBadge.textContent = '✓'; prevBadge.classList.add('done'); }
    }
    document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step' + n)?.classList.add('active');
    document.getElementById('step' + n)?.scrollIntoView({behavior:'smooth',block:'start'});
  };

  function _validateAddr() {
    const required = {addrName:'Full name',addrPhone:'Phone',addrLine1:'Address',addrCity:'City',addrPin:'Pincode'};
    for (const [id, label] of Object.entries(required)) {
      if (!document.getElementById(id)?.value.trim()) {
        showToast(`Please enter ${label}`, 'error');
        document.getElementById(id)?.focus();
        return false;
      }
    }
    if (!/^\d{6}$/.test(document.getElementById('addrPin').value.trim())) {
      showToast('Pincode must be 6 digits', 'error'); return false;
    }
    if (!/^\d{10}$/.test(document.getElementById('addrPhone').value.trim())) {
      showToast('Enter a valid 10-digit phone number', 'error'); return false;
    }
    return true;
  }

  window.selectDelivery = function(val) {
    _delivery = val;
    document.querySelectorAll('.delivery-opt').forEach(el => {
      const isSelected = el.dataset.val === val;
      el.classList.toggle('selected', isSelected);
      const radio = el.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });
    _updateTotals();
  };

  window.selectPayment = function(val) {
    _payment = val;
    document.querySelectorAll('.payment-opt').forEach(el => {
      const isSelected = el.dataset.val === val;
      el.classList.toggle('selected', isSelected);
      const radio = el.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });
    document.getElementById('onlineSubOpts').style.display = val === 'online' ? 'block' : 'none';
  };

  window.selectOnlineMode = function(btn, mode) {
    _onlineMode = mode;
    document.querySelectorAll('.online-mode-btn').forEach(b => {
      b.classList.toggle('btn-secondary', b === btn);
      b.classList.toggle('btn-ghost',     b !== btn);
    });
  };

  window.placeOrder = async function() {
    if (!Auth.isLoggedIn()) { openAuthModal(); return; }
    if (!_validateAddr()) return;

    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processing…';

    const del_charge = _delivery === 'local_partner' ? 40 : (_delivery === 'farmer_delivery' ? _calculatedFarmerDelCost : 0);
    const subtotal   = Cart.subtotal();
    const total      = subtotal + del_charge;

    const payload = {
      items: Cart.items.map(i => ({ product_id: i.product_id, qty: i.qty, price: i.price })),
      delivery_address: {
        name:    document.getElementById('addrName').value.trim(),
        phone:   '+91' + document.getElementById('addrPhone').value.trim(),
        line1:   document.getElementById('addrLine1').value.trim(),
        line2:   document.getElementById('addrLine2').value.trim(),
        city:    document.getElementById('addrCity').value.trim(),
        state:   document.getElementById('addrState').value,
        pincode: document.getElementById('addrPin').value.trim(),
        latitude:  parseFloat(document.getElementById('addrLat').value) || null,
        longitude: parseFloat(document.getElementById('addrLng').value) || null,
      },
      delivery_method: _delivery,
      payment_method:  _payment,
      subtotal, delivery_charge: del_charge, total,
    };

    try {
      if (_payment === 'cod') {
        const res = await API.createOrder(payload);
        if (res && res.order_id) _showSuccess(res.order_id);
      } else {
        /* Razorpay */
        const rzp = await API.createPaymentOrder(total);
        if (!rzp || !rzp.order_id) {
          throw new Error('Could not create payment order');
        }

        const opts = {
          key:      rzp.key_id,
          amount:   rzp.amount,
          currency: 'INR',
          name:     'AgriDirect',
          description: 'Fresh Farm Produce',
          order_id: rzp.razorpay_order_id,
          prefill:  { name: payload.delivery_address.name, contact: payload.delivery_address.phone },
          theme:    { color: '#38a169' },
          handler: async function(r) {
            const vPayload = { ...payload,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_order_id:   r.razorpay_order_id,
              razorpay_signature:  r.razorpay_signature,
            };
            const res = await API.verifyPayment(vPayload);
            if (res && res.order_id) {
              _showSuccess(res.order_id);
            } else {
              showToast('Payment verification failed', 'error');
            }
          },
          modal: { ondismiss: () => { btn.disabled=false; btn.innerHTML=`🛒 <span>${t('place_order')}</span>`; } }
        };
        new Razorpay(opts).open();
        return;
      }
    } catch(err) {
      showToast(err.message || 'Failed to place order', 'error');
      btn.disabled = false;
      btn.innerHTML = `🛒 <span>${t('place_order')}</span>`;
    }
  };

  function _showSuccess(orderId) {
    Cart.clear();
    document.getElementById('checkoutLayout').style.display = 'none';
    const success = document.getElementById('orderSuccess');
    success.style.display = 'block';
    document.getElementById('successOrderId').textContent = '#' + orderId;
    const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    document.getElementById('successOrderTime').textContent = 'Placed on ' + fmtDateTime(new Date());
    showToast(t('order_success'), 'success', '🎉');
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isLoggedIn()) { openAuthModal(); }
    renderCheckoutSummary();
  });
}

/* ============================================================
   CART PAGE  (cart.html)
   ============================================================ */
if (document.getElementById('cartPageList')) {
  window.renderCartPage = function() {
    const list = document.getElementById('cartPageList');
    if (!list) return; // Not on cart page
    const useTa = currentLang === 'ta';

    if (!Cart.items.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🛒</div>
        <h3 data-i18n="cart_empty">${t('cart_empty')}</h3>
        <p data-i18n="cart_empty_sub">${t('cart_empty_sub')}</p>
        <a href="products.html" class="btn btn-primary mt-16">Browse Products</a>
      </div>`;
      document.getElementById('cartSidePanel').style.display = 'none';
      return;
    }
    document.getElementById('cartSidePanel').style.display = 'block';

    list.innerHTML = Cart.items.map(item => `
      <div class="card mb-16" style="overflow:visible">
        <div class="card-body" style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:80px;height:80px;border-radius:var(--radius-md);background:var(--green-50);display:flex;align-items:center;justify-content:center;font-size:2rem;overflow:hidden;flex-shrink:0">
            ${item.image ? `<img src="${getFullImageUrl(item.image)}" style="width:100%;height:100%;object-fit:cover">` : getCategoryEmoji(item.category || '')}
          </div>
          <div style="flex:1">
            <div class="fw-600">${useTa ? item.name_ta : item.name}</div>
            <div class="text-sm text-muted mt-4">${item.farmer_name}</div>
            <div style="color:var(--green-700);font-weight:700;margin-top:6px">₹${item.price}${t(item.unit==='Dairy'?'per_liter':'per_kg')}</div>
            <div style="display:flex;align-items:center;gap:14px;margin-top:10px;flex-wrap:wrap">
              <div class="qty-control">
                <button class="qty-btn" onclick="Cart.setQty(${item.product_id},${item.qty-1});renderCartPage()">−</button>
                <input class="qty-input" type="number" value="${item.qty}" min="1"
                  onchange="Cart.setQty(${item.product_id},parseInt(this.value)||1);renderCartPage()">
                <button class="qty-btn" onclick="Cart.setQty(${item.product_id},${item.qty+1});renderCartPage()">+</button>
              </div>
              <span class="fw-600 text-green">₹${(item.price * item.qty).toFixed(2)}</span>
              <button class="btn btn-ghost btn-sm" style="color:var(--red-500);border-color:var(--red-100)"
                onclick="Cart.remove(${item.product_id});renderCartPage()">Remove</button>
            </div>
          </div>
        </div>
      </div>`).join('');

    const sub   = Cart.subtotal();
    const del   = sub > 500 ? 0 : 40;
    const grand = sub + del;
    document.getElementById('cartSubtotal').textContent = '₹' + sub.toFixed(2);
    document.getElementById('cartDelivery').textContent = del === 0 ? t('free') : '₹' + del;
    document.getElementById('cartTotal').textContent    = '₹' + grand.toFixed(2);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderCartPage();
  });

  document.addEventListener('cartUpdated', () => {
    if (typeof renderCartPage === 'function') renderCartPage();
  });
}

/* ============================================================
   ORDER TRACKING  (inline in customer dashboard / orders page)
   ============================================================ */
window.renderTrackingModal = function(order) {
  const stages = ['placed','confirmed','out_for_delivery','delivered'];
  const current = stages.indexOf(order.status);
  const stageLabels = {
    placed: t('status_placed'),
    confirmed: t('status_confirmed'),
    out_for_delivery: t('status_out_for_delivery'),
    delivered: t('status_delivered')
  };

  return `<div class="track-header" style="margin-bottom:24px;text-align:center">
    <div class="text-xs text-muted uppercase fw-700">${t('order_id')} #${order.id}</div>
    <div class="fw-600" style="font-size:1.2rem;color:var(--green-700)">${stageLabels[order.status] || order.status}</div>
    <div class="text-xs text-muted mt-4">${t('last_updated')}: ${fmtDateTime(new Date())}</div>
  </div>
  <div class="track-steps">
    ${stages.map((stage,i) => {
      const isDone = i < current || order.status === 'delivered';
      const isActive = i === current && order.status !== 'delivered';
      const isPending = i > current && order.status !== 'delivered';
      const histEntry = order.status_history?.find(h=>h.status===stage);

      return `
      <div class="track-step ${isDone ? 'done' : isActive ? 'active' : 'pending'}">
        <div class="track-dot">
          ${isDone ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' :
            isActive ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>' :
            `<span style="color:var(--gray-300);font-size:.75rem">${i+1}</span>`}
        </div>
        <div class="track-info">
          <h4>${stageLabels[stage]}</h4>
          <p>${(() => {
              if (histEntry?.timestamp) {
                return fmtDateTime(histEntry.timestamp);
              } else if (stage === 'placed') {
                return fmtDateTime(order.created_at);
              } else if (isDone) {
                return '<span style="color:var(--gray-400)">' + t('completed') + '</span>';
              } else {
                return '<span style="color:var(--gray-400)">' + t('pending') + '</span>';
              }
            })()}</p>
        </div>
      </div>`;
    }).join('')}
  </div>`;
};

/* ============================================================
   WRITE REVIEW MODAL
   ============================================================ */
const _ratings = { quality:0, delivery:0, overall:0 };

window.openReviewModal = function(orderId) {
  _ratings.quality = _ratings.delivery = _ratings.overall = 0;
  document.getElementById('reviewOrderId').value = orderId;
  document.querySelectorAll('.star-picker span').forEach(s => s.classList.remove('filled'));
  document.getElementById('reviewComment').value = '';
  document.getElementById('reviewOverlay').classList.add('open');
};

window.closeReviewModal = function() {
  document.getElementById('reviewOverlay')?.classList.remove('open');
};

window.setReviewRating = function(key, val, el) {
  _ratings[key] = val;
  const picker = el.closest('.star-picker');
  picker.querySelectorAll('span').forEach((s, i) => s.classList.toggle('filled', i < val));
};

window.submitReview = async function() {
  const orderId = document.getElementById('reviewOrderId').value;
  if (!_ratings.quality || !_ratings.delivery || !_ratings.overall) {
    showToast('Please rate all categories', 'error'); return;
  }
  try {
    const reviewPayload = {
      order_id:        +orderId,
      product_quality: _ratings.quality,
      delivery_time:   _ratings.delivery,
      overall_service: _ratings.overall,
      comment:         document.getElementById('reviewComment').value.trim(),
    };
    await API.submitReview(reviewPayload);
    showToast('Review submitted! Thank you ⭐', 'success');
    closeReviewModal();
    /* reload orders if on dashboard */
    if (typeof loadOrders === 'function') loadOrders();
  } catch(err) { showToast(err.message || 'Failed to submit review', 'error'); }
};
