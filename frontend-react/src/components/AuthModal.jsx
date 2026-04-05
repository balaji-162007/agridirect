import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API, API_BASE } from '../services/api';

const AuthModal = () => {
  const { isModalOpen, closeAuthModal, modalTab, setModalTab, modalRole, setModalRole, loginUser } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  
  // OTP related
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);
  const [resendTimer, setResendTimer] = useState(30);
  const [shake, setShake] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [location, setLocation] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const photoInputRef = useRef(null);

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Could not access camera. Please check permissions.");
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
      
      // Artificial shutter sound or haptic could go here
      
      canvas.toBlob((blob) => {
        const file = new File([blob], "captured-photo.jpg", { type: "image/jpeg" });
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(blob));
        setTimeout(() => stopCamera(), 300); // Slightly longer delay for the flash effect to be seen
      }, 'image/jpeg', 0.9);
    }
  };

  // Reset core states on modal open
  useEffect(() => {
    if (isModalOpen) {
      setStep('phone');
      setError('');
      setOtp(['', '', '', '', '', '']);
      setResendTimer(30);
      setShake(false);
    }
  }, [isModalOpen, modalTab]);

  // Handle Resend countdown
  useEffect(() => {
    let timer;
    if (step === 'otp' && resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendTimer]);

  // Attach camera stream when browser renders the <video> element
  useEffect(() => {
    if (showCamera && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCamera, cameraStream]);

  if (!isModalOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target.id === 'authOverlay') closeAuthModal();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (modalTab === 'register' && !name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    
    setError('');
    setLoading(true);
    try {
      // ✅ CONNECTING TO BACKEND API (React)
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: '+91' + phone, role: modalRole })
      });

      const data = await res.json();
      console.log("Send OTP Response:", data);

      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');

      setStep('otp');
      setResendTimer(30);
      setOtp(['', '', '', '', '', '']);
      // Focus the first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const val = value.replace(/\D/g, '');
    if (!val && val !== '') return;
    
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Auto focus next input
    if (val && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    
    const newOtp = [...otp];
    pasted.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setError('Enter the complete 6-digit OTP');
      triggerShake();
      return;
    }

    setError('');
    setLoading(true);
    try {
      let resp;
      if (modalTab === 'register') {
        const fd = new FormData();
        fd.append('phone', '+91' + phone);
        fd.append('otp', otpValue);
        fd.append('name', name);
        fd.append('role', modalRole);
        if (location) fd.append('location', location);
        if (farmName && modalRole === 'farmer') fd.append('farm_name', farmName);
        if (photo) fd.append('profile_photo', photo);

        resp = await API.register(fd);
      } else {
        // ✅ VERIFY OTP (React)
        const res = await fetch(`${API_BASE}/auth/verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: '+91' + phone, otp: otpValue })
        });
        
        resp = await res.json();
        console.log("Verify OTP Response:", resp);
        if (!res.ok) throw new Error(resp.message || 'Invalid OTP');
      }

      if (resp && resp.token) {
        // ✅ STEP 4 — SAVING TOKEN (Match user snippet)
        localStorage.setItem("token", resp.token);
        loginUser(resp.token, resp.user);
        closeAuthModal();
      } else {
        alert("Invalid OTP");
        throw new Error('Invalid OTP response');
      }
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShake(false);
    setTimeout(() => setShake(true), 10);
    setTimeout(() => setShake(false), 400);
  };

  return (
    <div className="overlay open" id="authOverlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">🌿 AgriDirect</span>
          <button className="modal-close" onClick={closeAuthModal}>✕</button>
        </div>
        <div className="modal-body">
          <div className="auth-tabs">
            <button className={`auth-tab ${modalTab === 'login' ? 'active' : ''}`} onClick={() => setModalTab('login')}>
              {t('login') || 'Login'}
            </button>
            <button className={`auth-tab ${modalTab === 'register' ? 'active' : ''}`} onClick={() => setModalTab('register')}>
              {t('register') || 'Register'}
            </button>
          </div>
          
          <div id="authBody">
            <div className="auth-card">
              
              {error && (
                <div style={{ color: 'var(--red-500)', marginBottom: '16px', fontSize: '0.9rem', padding: '12px', background: 'var(--red-100)', borderRadius: 'var(--radius-md)', fontWeight: '500' }}>
                  {error}
                </div>
              )}

              {step === 'phone' ? (
                <form onSubmit={handleSendOTP}>
                  {modalTab === 'register' ? (
                    <>
                      <div className="profile-upload-wrap mb-16">
                        <div className="profile-preview-lg" id="regPhotoPreview">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Profile preview" />
                          ) : (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                            </svg>
                          )}
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

                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <input 
                          type="file" 
                          id="authPhoto" 
                          hidden 
                          accept="image/*" 
                          ref={photoInputRef}
                          onChange={handlePhotoChange}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => photoInputRef.current?.click()}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            {t('upload') || 'Upload'}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={startCamera}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            {t('take_photo') || 'Take Photo'}
                          </button>
                        </div>
                      </div>

                      <div className="user-type-row">
                        <label className="user-type-opt">
                          <input 
                            type="radio" 
                            name="utype" 
                            value="customer" 
                            checked={modalRole === 'customer'}
                            onChange={() => setModalRole('customer')}
                          />
                          <span className="user-type-label">
                            <span className="user-type-icon">🛒</span>
                            <span className="user-type-text">{t('i_am_customer') || 'I am Customer'}</span>
                          </span>
                        </label>
                        {modalRole !== 'customer' && (
                          <label className="user-type-opt">
                            <input 
                              type="radio" 
                              name="utype" 
                              value="farmer" 
                              checked={modalRole === 'farmer'}
                              onChange={() => setModalRole('farmer')}
                            />
                            <span className="user-type-label">
                              <span className="user-type-icon">🌾</span>
                              <span className="user-type-text">{t('i_am_farmer') || 'I am Farmer'}</span>
                            </span>
                          </label>
                        )}
                      </div>

                      <div className="form-group mb-16">
                        <label className="form-label">{t('full_name') || 'Full Name'} <span className="req">*</span></label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Your full name" 
                          value={name}
                          onChange={e => setName(e.target.value)}
                          disabled={loading}
                          required
                        />
                      </div>

                      {modalRole === 'farmer' && (
                         <div className="form-group mb-16">
                           <label className="form-label">{t('farm_name') || 'Farm Name'}</label>
                           <input 
                             type="text" 
                             className="form-input" 
                             placeholder="e.g. Green Valley Farms" 
                             value={farmName}
                             onChange={e => setFarmName(e.target.value)}
                             disabled={loading}
                           />
                         </div>
                      )}
                      
                      <div className="form-group mb-16">
                        <label className="form-label">{t('location') || 'Location'}</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Village / City" 
                          value={location}
                          onChange={e => setLocation(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="form-group mb-22">
                    <label className="form-label">{t('mobile_no') || 'Mobile No'} <span className="req">*</span></label>
                    <div className="phone-row">
                      <span className="phone-prefix">
                        🇮🇳 +91
                      </span>
                      <input 
                        type="tel" 
                        maxLength="10" 
                        placeholder="10-digit number" 
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? <span className="spinner"></span> : <span>{t('continue_btn') || 'Continue'}</span>}
                  </button>
                </form>
              ) : (
                <div className="otp-step">
                  <div className="text-center mb-16">
                    <div style={{ fontSize: '2.4rem', marginBottom: '10px' }}>📱</div>
                    <p className="fw-600">{t('otp_sent') || 'OTP Sent'}</p>
                    <p className="text-muted">+91 {phone}</p>
                    {modalTab === 'register' && (
                      <p className="text-muted" style={{ fontSize: '.82rem', marginTop: '4px' }}>
                        Registering as <b>{name}</b> ({modalRole})
                      </p>
                    )}
                  </div>
                  
                  <div className="otp-row" id="otpRow" style={{ animation: shake ? 'shake 0.4s ease' : 'none' }}>
                    {otp.map((digit, i) => (
                      <input 
                        key={i}
                        ref={el => otpRefs.current[i] = el}
                        className="otp-input" 
                        type="text" 
                        maxLength="1" 
                        inputMode="numeric"
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        onPaste={handleOtpPaste}
                        disabled={loading}
                      />
                    ))}
                  </div>

                  <button className="btn btn-primary btn-full mt-16" onClick={handleVerifyOTP} disabled={loading}>
                     {loading ? <span className="spinner"></span> : <span>{t('verify') || 'Verify'}</span>}
                  </button>

                  <div className="text-center mt-16" style={{ fontSize: '.85rem', color: 'var(--gray-500)' }}>
                    {resendTimer > 0 ? (
                      <span>{t('resend_in') || 'Resend in'} <b>{resendTimer}</b> {t('seconds') || 'seconds'}</span>
                    ) : (
                      <a 
                        href="#" 
                        style={{ color: 'var(--green-600)', fontWeight: '600', textDecoration: 'none' }}
                        onClick={(e) => { e.preventDefault(); handleSendOTP(); }}
                      >
                        {t('resend') || 'Resend OTP'}
                      </a>
                    )}
                  </div>
                  
                  <button 
                    className="btn btn-ghost btn-sm mt-12 w-full" 
                    onClick={() => setStep('phone')} 
                    disabled={loading}
                  >
                    ← {t('back') || 'Back'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
