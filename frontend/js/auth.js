/* ============================================================
   auth.js  –  Authentication, session, toast, nav helpers
   ============================================================ */

if (typeof API_BASE === 'undefined') {
  window.API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8000/api"
    : "https://agridirect-zwew.onrender.com/api";
  window.BASE_URL = window.API_BASE.replace(/\/api$/, "");
}

function getFullImageUrl(path) {
  if (!path) return "";
  const pathStr = path.toString();
  if (pathStr.startsWith('http') || pathStr.startsWith('data:')) return pathStr;
  
  const cleanPath = pathStr.startsWith('/') ? pathStr.slice(1) : pathStr;
  const baseUrl = (window.BASE_URL || 'https://agridirect-zwew.onrender.com').replace(/\/$/, '');
  
  return `${baseUrl}/${cleanPath}`;
}

/* ── State ── */
window.Auth = {
  user:  null,
  token: localStorage.getItem('agri_token') || null,

  init() {
    try { 
      this.user = JSON.parse(localStorage.getItem('agri_user') || 'null'); 
      // Show logout toast if redirected from logout
      if (localStorage.getItem('agri_logout_flag')) {
        localStorage.removeItem('agri_logout_flag');
        setTimeout(() => showToast('Logged out successfully', 'info'), 500);
      }
    } catch(e) { 
      console.error('Auth state error:', e); 
    }
  },

  login(user, token) {
    this.user  = user;
    this.token = token;
    localStorage.setItem('agri_user',  JSON.stringify(user));
    localStorage.setItem('agri_token', token);
    
    // Global redirection logic for farmers on login
    if (user.role === 'farmer') {
      setTimeout(() => {
        window.location.href = 'farmer-dashboard.html';
      }, 500);
    } else {
      refreshNavUI();
    }
  },

  logout() {
    this.user  = null;
    this.token = null;
    localStorage.removeItem('agri_user');
    localStorage.removeItem('agri_token');
    
    // Clear cart on logout
    if (window.Cart && typeof window.Cart.clear === 'function') {
      window.Cart.clear();
    } else {
      localStorage.removeItem('agri_cart');
    }

    // Set flag to show toast after redirect
    localStorage.setItem('agri_logout_flag', 'true');

    refreshNavUI();
    // Redirect IMMEDIATELY to home page to leave dashboard
    window.location.href = 'index.html';
  },

  isLoggedIn()  { return !!this.token; },
  isFarmer()    { return this.user?.role === 'farmer'; },
  isCustomer()  { return this.user?.role === 'customer'; },
};

/* ── Global Redirects ── */
(function() {
  const path = window.location.pathname;
  const userStr = localStorage.getItem('agri_user');
  const token = localStorage.getItem('agri_token');
  
  const onAuthPage = path.endsWith('login.html') || path.endsWith('register.html');
  
  // 1. Force entry to login page if not authenticated (only for protected pages)
  const protectedPages = ['farmer-dashboard.html', 'customer-dashboard.html', 'checkout.html'];
  const isProtected = protectedPages.some(p => path.endsWith(p));
  
  if (!token && isProtected) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Redirect logged-in users to their respective dashboards if they hit the home page
  const fileName = path.split('/').pop();
  const isHome = fileName === 'index.html' || fileName === '';
  
  if (token && isHome) {
    try {
      const user = JSON.parse(userStr);
      if (user.role === 'farmer') {
        window.location.href = 'farmer-dashboard.html';
        return;
      } else if (user.role === 'customer') {
        window.location.href = 'customer-dashboard.html';
        return;
      }
    } catch(e) { console.error("Redirect error:", e); }
  }

  // 3. Redirect logged-in farmers from login page to dashboard
  if (token && onAuthPage) {
    try {
      const u = JSON.parse(userStr);
      if (u.role === 'farmer' && onAuthPage) {
        window.location.href = 'farmer-dashboard.html';
      }
    } catch(e) {}
  }
})();

/* ── API helper (Now handled by api.js) ── */
/* ... removed ... */

/* ── Toast ── */
function showToast(msg, type = 'info', icon = null) {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icon || icons[type]}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.cssText = 'opacity:0;transform:translateX(20px);transition:all .3s ease';
    setTimeout(() => el.remove(), 320);
  }, 3400);
}

/* ── Nav ── */
function refreshNavUI() {
  const u = Auth.user;
  document.querySelectorAll('.js-show-guest').forEach(el => el.style.display = u ? 'none' : '');
  document.querySelectorAll('.js-show-user').forEach(el => el.style.display  = u ? '' : 'none');
  
  // Role-based visibility
  const isCustomer = u && u.role === 'customer';
  const isFarmer   = u && u.role === 'farmer';
  
  document.querySelectorAll('.js-hide-customer').forEach(el => el.style.display = isCustomer ? 'none' : '');
  document.querySelectorAll('.js-hide-farmer').forEach(el => el.style.display = isFarmer ? 'none' : '');

  const navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    navLinks.classList.toggle('js-farmer-mode', isFarmer);
  }

  const nameEl = document.getElementById('navUserInitial');
  const navAvatar = document.getElementById('userAvatar');
  if (u && navAvatar) {
    navAvatar.href = u.role === 'farmer' ? 'farmer-dashboard.html?section=profile' : 'customer-dashboard.html?section=profile';
    const fullPhotoUrl = getFullImageUrl(u.profile_photo);
    if (fullPhotoUrl && fullPhotoUrl.startsWith("http")) {
      navAvatar.innerHTML = `<img src="${fullPhotoUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.onerror=null;this.src='https://via.placeholder.com/150';">`;
      navAvatar.style.background = 'var(--gray-100)';
    } else {
      const initial = (u.name || 'U')[0].toUpperCase();
      navAvatar.innerHTML = `<span id="navUserInitial">${initial}</span>`;
      navAvatar.style.background = '';
    }
  }

  const dashLink = document.getElementById('navDashLink');
  if (dashLink && u) {
    dashLink.href = u.role === 'farmer'
      ? 'farmer-dashboard.html'
      : 'customer-dashboard.html';
  }

  // Brand link redirection for farmers
  const brandLink = document.querySelector('.brand');
  if (brandLink && isFarmer) {
    brandLink.href = 'farmer-dashboard.html';
  } else if (brandLink) {
    brandLink.href = 'index.html';
  }
}

/* Scroll effect */
window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 10);
});

/* ── OTP Auth Modal ── */
var _otpPhone = _otpPhone || '', _otpMode = _otpMode || 'login', _otpTimer = _otpTimer || null;
// FIX 2: Saved register-form values captured BEFORE OTP step replaces the DOM.
// (The name/role/location/farm inputs live in the "phone" step; once we switch
//  to the OTP step those elements are gone from the DOM entirely.)
var _regName = _regName || '', _regRole = _regRole || 'customer', _regLoc = _regLoc || '', _regFarm = _regFarm || '', _regPhoto = _regPhoto || null;

function openAuthModal(mode = 'login', role = 'customer') {
  _otpMode = mode;
  _regRole = role; // Set the default role
  const overlay = document.getElementById('authOverlay');
  if (overlay) { overlay.classList.add('open'); _renderAuthStep('phone'); }
}
function closeAuthModal() {
  document.getElementById('authOverlay')?.classList.remove('open');
  if (_otpTimer) clearInterval(_otpTimer);
  _regPhoto = null;
}

function previewAuthPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  _regPhoto = file;
  const reader = new FileReader();
  reader.onload = e => {
    const el = document.getElementById('regPhotoPreview');
    if (el) el.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
  };
  reader.readAsDataURL(file);
}

function switchAuthTab(mode, role = 'customer') {
  _otpMode = mode;
  _regRole = role;
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${mode}`)?.classList.add('active');
  _renderAuthStep('phone');
}

function _renderAuthStep(step) {
  const body = document.getElementById('authBody');
  if (!body) return;

  if (step === 'phone') {
    body.innerHTML = `
      ${_otpMode === 'register' ? `
      <div class="profile-upload-wrap mb-16">
        <div class="profile-preview-lg" id="regPhotoPreview">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
        <input type="file" id="authPhoto" hidden accept="image/*" onchange="previewAuthPhoto(this)">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('authPhoto').click()">
          ${t('add_profile_photo')}
        </button>
      </div>
      <div class="user-type-row">
        <label class="user-type-opt">
          <input type="radio" name="utype" value="customer" ${_regRole === 'customer' ? 'checked' : ''}>
          <span class="user-type-label">
            <span class="user-type-icon">🛒</span>
            <span class="user-type-text" data-i18n="i_am_customer">${t('i_am_customer')}</span>
          </span>
        </label>
        <label class="user-type-opt">
          <input type="radio" name="utype" value="farmer" ${_regRole === 'farmer' ? 'checked' : ''}>
          <span class="user-type-label">
            <span class="user-type-icon">🌾</span>
            <span class="user-type-text" data-i18n="i_am_farmer">${t('i_am_farmer')}</span>
          </span>
        </label>
      </div>
      <div class="form-group mb-16">
        <label class="form-label" data-i18n="full_name">${t('full_name')} <span class="req">*</span></label>
        <input type="text" id="authName" class="form-input" placeholder="Your full name">
      </div>
      <div class="form-group mb-16" id="farmNameRow" style="${_regRole === 'farmer' ? 'display:flex' : 'display:none'}">
        <label class="form-label" data-i18n="farm_name">${t('farm_name')}</label>
        <input type="text" id="authFarm" class="form-input" placeholder="e.g. Green Valley Farms">
      </div>
      <div class="form-group mb-16">
        <label class="form-label" data-i18n="location">${t('location')}</label>
        <input type="text" id="authLoc" class="form-input" placeholder="Village / City">
      </div>` : ''}
      <div class="form-group mb-22">
        <label class="form-label" data-i18n="mobile_no">${t('mobile_no')} <span class="req">*</span></label>
        <div class="phone-row">
          <span class="phone-prefix">🇮🇳 +91</span>
          <input type="tel" id="authPhone" maxlength="10" placeholder="10-digit number">
        </div>
      </div>
      <button class="btn btn-primary btn-full" id="sendOtpBtn" onclick="sendOtp()">
        <span data-i18n="continue_btn">${t('continue_btn')}</span>
      </button>`;

    body.querySelectorAll('input[name="utype"]').forEach(r =>
      r.addEventListener('change', () => {
        document.getElementById('farmNameRow').style.display =
          r.value === 'farmer' && r.checked ? 'flex' : 'none';
      })
    );

  } else if (step === 'otp') {
    body.innerHTML = `
      <div class="text-center mb-16">
        <div style="font-size:2.4rem;margin-bottom:10px">📱</div>
        <p class="fw-600">${t('otp_sent')}</p>
        <p class="text-muted">+91 ${_otpPhone}</p>
        ${_otpMode === 'register' ? `<p class="text-muted" style="font-size:.82rem;margin-top:4px">Registering as <b>${_regName}</b> (${_regRole})</p>` : ''}
      </div>
      <div class="otp-row" id="otpRow">
        ${Array(6).fill('<input class="otp-input" type="text" maxlength="1" inputmode="numeric">').join('')}
      </div>
      <button class="btn btn-primary btn-full" id="verifyOtpBtn" onclick="verifyOtp()">
        <span data-i18n="verify">${t('verify')}</span>
      </button>
      <div class="text-center mt-16" style="font-size:.85rem;color:var(--gray-500)">
        <span id="resendLabel">${t('resend_in')} <b id="resendSec">30</b>${t('seconds')}</span>
        <a href="#" id="resendLink" style="display:none;color:var(--green-600);font-weight:600"
           onclick="sendOtp(event)">${t('resend')}</a>
      </div>
      <button class="btn btn-ghost btn-sm mt-12 w-full" onclick="_renderAuthStep('phone')">← ${t('back')}</button>`;

    _setupOtp();
    _startResendTimer();
  }
}

function _setupOtp() {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      // strip non-digits
      inp.value = inp.value.replace(/\D/g, '');
      if (inp.value && i < 5) inputs[i + 1].focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
    });
    inp.addEventListener('paste', e => {
      e.preventDefault();
      const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      inputs.forEach((el, j) => { el.value = d[j] || ''; });
      // focus last filled box
      const last = Math.min(d.length, 5);
      inputs[last]?.focus();
    });
  });
  inputs[0]?.focus();
}

function _startResendTimer() {
  let s = 30;
  if (_otpTimer) clearInterval(_otpTimer);
  const sec  = document.getElementById('resendSec');
  const lbl  = document.getElementById('resendLabel');
  const link = document.getElementById('resendLink');
  _otpTimer = setInterval(() => {
    s--;
    if (sec) sec.textContent = s;
    if (s <= 0) {
      clearInterval(_otpTimer);
      if (lbl)  lbl.style.display  = 'none';
      if (link) link.style.display = 'inline';
    }
  }, 1000);
}

async function sendOtp(e) {
  if (e) e.preventDefault();
  const phone = document.getElementById('authPhone')?.value.trim();
  if (!/^\d{10}$/.test(phone)) {
    showToast('Enter a valid 10-digit number', 'error');
    return;
  }

  // FIX 2: Capture register fields NOW, before _renderAuthStep('otp') wipes them from the DOM
  if (_otpMode === 'register') {
    _regName = document.getElementById('authName')?.value.trim() || '';
    _regRole = document.querySelector('input[name="utype"]:checked')?.value || 'customer';
    _regLoc  = document.getElementById('authLoc')?.value.trim()  || '';
    _regFarm = document.getElementById('authFarm')?.value.trim() || '';
    _regPhoto = document.getElementById('authPhoto')?.files[0] || null;
    if (!_regName) {
      showToast('Please enter your name', 'error');
      document.getElementById('authName')?.focus();
      return;
    }
  }

  const btn = document.getElementById('sendOtpBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }

  try {
      // Send OTP
      await API.sendOTP('+91' + phone);
      _otpPhone = phone;
    _renderAuthStep('otp');
    showToast(`OTP sent to +91 ${phone}`, 'success', '📱');
  } catch (err) {
    showToast(err.message || 'Failed to send OTP', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = `<span>${t('continue_btn')}</span>`; }
  }
}

async function verifyOtp() {
  const inputs = document.querySelectorAll('.otp-input');
  const otp = Array.from(inputs).map(i => i.value).join('');
  if (otp.length !== 6) { showToast('Enter the complete 6-digit OTP', 'error'); return; }

  const btn = document.getElementById('verifyOtpBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }

  try {
    let data;
    if (_otpMode === 'register') {
      // FIX 2: Use the values saved in sendOtp() — DOM inputs are gone at this point
      const fd = new FormData();
      fd.append('phone', '+91' + _otpPhone);
      fd.append('otp', otp);
      fd.append('name', _regName);
      fd.append('role', _regRole);
      if (_regLoc) fd.append('location', _regLoc);
      if (_regFarm) fd.append('farm_name', _regFarm);
      if (_regPhoto) fd.append('profile_photo', _regPhoto);

      data = await API.register(fd);
    } else {
      data = await API.verifyOTP('+91' + _otpPhone, otp);
    }

    if (data) {
      Auth.login(data.user, data.token);
      closeAuthModal();
      showToast(`Welcome, ${data.user.name}! 🌿`, 'success');
      
      // ✅ STEP 2: Update local storage and redirect
      localStorage.setItem("user", JSON.stringify(data.user));
      
      const onLoginPage = window.location.pathname.includes('login.html');
      if (onLoginPage) {
        window.location.href = data.user.role === 'farmer' ? 'farmer-dashboard.html' : 'index.html';
      }
    }
  } catch (err) {
    // FIX 1: err.message is now always a clean human-readable string
    showToast(err.message || 'Invalid OTP. Please try again.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = `<span>${t('verify')}</span>`; }
    // Shake the OTP row to signal error
    const row = document.getElementById('otpRow');
    if (row) {
      row.style.animation = 'none';
      row.offsetHeight; // reflow
      row.style.animation = 'shake 0.4s ease';
    }
  }
}

/* Close dropdowns on outside click */
document.addEventListener('click', e => {
  const ud = document.getElementById('userDropdown');
  const ua = document.getElementById('userAvatar');
  if (ud && !ud.contains(e.target) && !ua?.contains(e.target)) ud.classList.remove('open');

  if (!e.target.closest('.more-menu-wrap')) {
    document.getElementById('moreDropdown')?.classList.remove('open');
  }
});

/* Init nav on load */
document.addEventListener('DOMContentLoaded', () => {
  // Ensure any old Service Worker is unregistered (since we removed PWA features)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister().then(() => console.log('Old Service Worker Unregistered'));
      }
    });
  }

  if (window.Auth && typeof window.Auth.init === 'function') {
    window.Auth.init();
  }
  refreshNavUI();

  document.getElementById('authOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'authOverlay') closeAuthModal();
  });

  document.getElementById('userAvatar')?.addEventListener('click', (e) => {
    const isFarmerDash = window.location.pathname.includes('farmer-dashboard.html');
    const isCustomerDash = window.location.pathname.includes('customer-dashboard.html');
    
    if (isFarmerDash || isCustomerDash) {
      e.preventDefault();
      if (typeof showPanel === 'function') {
        showPanel('profile');
      }
    } else {
      document.getElementById('userDropdown')?.classList.toggle('open');
    }
  });

  /* Bottom Navigation - Active State Management */
  const path = window.location.pathname;
  const navItems = document.querySelectorAll('.mobile-bottom-nav .nav-item');
  
  navItems.forEach(item => {
    const href = item.getAttribute('href');
    if (path.includes(href)) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Special cases for subpages
  if (path.includes('customer-dashboard.html')) {
    document.querySelector('.mobile-bottom-nav .nav-item[href="customer-dashboard.html"]')?.classList.add('active');
  }
});