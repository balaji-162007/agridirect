import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API, API_BASE } from '../services/api';

const LoginPage = () => {
  const { loginUser, isLoggedIn, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get('mode') || 'login'); // 'login' | 'register'
  const [role, setRole] = useState(searchParams.get('role') || 'customer'); // 'customer' | 'farmer'
  
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

  useEffect(() => {
    if (isLoggedIn) {
      navigate(user?.role === 'farmer' ? '/farmer-dashboard.html' : '/customer-dashboard.html');
    }
  }, [isLoggedIn, navigate, user]);

  useEffect(() => {
    let timer;
    if (step === 'otp' && resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendTimer]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
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

      const flash = document.getElementById('shutterFlash');
      if (flash) {
        flash.classList.remove('active');
        void flash.offsetWidth; 
        flash.classList.add('active');
      }
      
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], "captured-photo.jpg", { type: "image/jpeg" });
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(blob));
        setTimeout(() => stopCamera(), 300);
      }, 'image/jpeg', 0.9);
    }
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
    if (tab === 'register' && !name.trim()) {
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
        body: JSON.stringify({ phone: '+91' + phone, role, mode: tab })
      });

      const data = await res.json();
      console.log("Send OTP Response:", data);

      if (!res.ok) {
        const errorMsg = data.detail || data.message || 'Failed to send OTP';
        throw new Error(errorMsg);
      }

      setStep('otp');
      setResendTimer(30);
      setOtp(['', '', '', '', '', '']);
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
    if (val && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    pasted.split('').forEach((char, i) => { if (i < 6) newOtp[i] = char; });
    setOtp(newOtp);
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) { setError('Enter the complete 6-digit OTP'); triggerShake(); return; }

    setError('');
    setLoading(true);
    try {
      let resp;
      if (tab === 'register') {
        const fd = new FormData();
        fd.append('phone', '+91' + phone);
        fd.append('otp', otpValue);
        fd.append('name', name);
        fd.append('role', role);
        if (location) fd.append('location', location);
        if (farmName && role === 'farmer') fd.append('farm_name', farmName);
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
        if (!res.ok) {
          const errorMsg = resp.detail || resp.message || 'Invalid OTP';
          throw new Error(errorMsg);
        }
      }

      if (resp && resp.token) {
        // ✅ STEP 4 — SAVING TOKEN (Match user snippet)
        localStorage.setItem("token", resp.token);
        loginUser(resp.token, resp.user);
        
        // Use standard routes but keep navigation logic
        navigate(resp.user.role === 'farmer' ? '/farmer-dashboard.html' : '/customer-dashboard.html');
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
    <div className="login-page-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'linear-gradient(135deg, var(--green-50) 0%, #fff 100%)' }}>
      <div style={{ maxWidth: '480px', width: '100%', background: '#fff', borderRadius: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', padding: '40px', border: '1px solid var(--gray-100)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--green-700)', fontWeight: 800 }}>🌿 AgriDirect</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--gray-500)', fontSize: '1.1rem' }}>{tab === 'login' ? 'Welcome back!' : 'Create your account'}</p>
        </div>

        <div className="auth-tabs" style={{ marginBottom: '32px' }}>
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setStep('phone'); setError(''); }} style={{ flex: 1 }}>
            {t('login') || 'Login'}
          </button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setStep('phone'); setError(''); }} style={{ flex: 1 }}>
            {t('register') || 'Register'}
          </button>
        </div>

        {error && (
          <div style={{ color: 'var(--red-500)', marginBottom: '24px', fontSize: '0.95rem', padding: '12px 16px', background: 'var(--red-50)', borderRadius: '12px', fontWeight: '500', border: '1px solid var(--red-100)' }}>
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOTP}>
            {tab === 'register' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                  <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--green-100)', background: 'var(--gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '2.5rem' }}>👤</span>
                    )}
                    {showCamera && (
                      <div className="camera-overlay">
                        <div className="camera-container">
                          <video ref={videoRef} autoPlay playsInline className="camera-viewfinder" />
                          <div className="shutter-flash" id="shutterFlash"></div>
                          <div className="camera-controls">
                            <button type="button" className="btn-camera-close" onClick={stopCamera}>✕</button>
                            <button type="button" className="btn-shutter" onClick={capturePhoto}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <div style={{width: '44px'}}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => photoInputRef.current?.click()}>Upload</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={startCamera}>Take Photo</button>
                  <input type="file" ref={photoInputRef} hidden accept="image/*" onChange={handlePhotoChange} />
                  <canvas ref={canvasRef} hidden />
                </div>

                <div className="user-type-row" style={{ marginBottom: '24px' }}>
                  <label className="user-type-opt">
                    <input type="radio" checked={role === 'customer'} onChange={() => setRole('customer')} />
                    <span className="user-type-label"><span className="user-type-icon">🛒</span> Customer</span>
                  </label>
                  {searchParams.get('role') !== 'customer' && (
                    <label className="user-type-opt">
                      <input type="radio" checked={role === 'farmer'} onChange={() => setRole('farmer')} />
                      <span className="user-type-label"><span className="user-type-icon">🌾</span> Farmer</span>
                    </label>
                  )}
                </div>

                <div className="form-group mb-16">
                  <label className="form-label">Full Name <span className="req">*</span></label>
                  <input type="text" className="form-input" placeholder="Enter your name" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                {role === 'farmer' && (
                  <div className="form-group mb-16">
                    <label className="form-label">Farm Name</label>
                    <input type="text" className="form-input" placeholder="e.g. Green Valley" value={farmName} onChange={e => setFarmName(e.target.value)} />
                  </div>
                )}
                <div className="form-group mb-24">
                  <label className="form-label">Location</label>
                  <input type="text" className="form-input" placeholder="City / Village" value={location} onChange={e => setLocation(e.target.value)} />
                </div>
              </>
            )}

            <div className="form-group mb-32">
              <label className="form-label">Mobile Number <span className="req">*</span></label>
              <div className="phone-row">
                <span className="phone-prefix">🇮🇳 +91</span>
                <input type="tel" maxLength="10" placeholder="10-digit mobile number" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <span className="spinner"></span> : <span>Continue</span>}
            </button>
          </form>
        ) : (
          <div className="otp-step">
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📱</div>
              <p style={{ fontWeight: 700, fontSize: '1.2rem', margin: 0 }}>Verify OTP</p>
              <p style={{ color: 'var(--gray-500)', margin: '8px 0 0' }}>Enter the 6-digit code sent to<br/><b>+91 {phone}</b></p>
            </div>

            <div className="otp-row" style={{ animation: shake ? 'shake 0.4s ease' : 'none', marginBottom: '24px' }}>
              {otp.map((digit, i) => (
                <input key={i} ref={el => otpRefs.current[i] = el} className="otp-input" type="text" maxLength="1" inputMode="numeric" value={digit} onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)} onPaste={handleOtpPaste} disabled={loading} />
              ))}
            </div>

            <button className="btn btn-primary btn-full btn-lg" onClick={handleVerifyOTP} disabled={loading}>
              {loading ? <span className="spinner"></span> : <span>Verify code</span>}
            </button>

            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: 'var(--gray-500)' }}>
              {resendTimer > 0 ? (
                <span>Resend in <b>{resendTimer}</b>s</span>
              ) : (
                <button className="btn-link" onClick={() => handleSendOTP()} style={{ color: 'var(--green-600)', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer' }}>Resend OTP</button>
              )}
            </div>
            
            <button className="btn btn-ghost btn-sm mt-32 w-full" onClick={() => setStep('phone')} disabled={loading}>← Back to phone</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
