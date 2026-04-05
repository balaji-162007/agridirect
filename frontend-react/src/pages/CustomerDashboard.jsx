import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { API } from '../services/api';
import { useToast } from '../components/Toast';

const getFullImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `https://agridirect-zwew.onrender.com${path}`;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'}) : '';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';

const renderStars = (n, max = 5) => {
  return Array.from({length: max}, (_, i) => (
    <span key={i} style={{ color: i < Math.round(n) ? 'var(--amber-500)' : 'var(--gray-200)' }}>★</span>
  ));
};

const CustomerDashboard = () => {
  const { user, login, isLoggedIn } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('profile');

  // Profile Form state
  const [profileData, setProfileData] = useState({ name: '', phone: '', location: '' });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [locFeedback, setLocFeedback] = useState('');
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);

  // Modals state
  const [trackOrder, setTrackOrder] = useState(null); // The full order object if tracking
  const [reviewOrderId, setReviewOrderId] = useState(null);
  const [reviewForm, setReviewForm] = useState({ quality: 5, delivery: 5, overall: 5, comment: '' });

  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'profile') {
      setActiveTab('profile');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login.html');
      return;
    }
    if (user?.role === 'farmer') {
      navigate('/farmer-dashboard.html');
      return;
    }

    if (activeTab === 'profile') {
      setProfileData({ name: user.name || '', phone: user.phone || '', location: user.location || '' });
    }
  }, [activeTab, isLoggedIn, navigate, user]);


  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err) {
      console.error("Camera access error:", err);
      toast('Could not access camera. Please check permissions.', 'error');
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
      
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], "captured-photo.jpg", { type: "image/jpeg" });
        setProfilePhoto(file);
        setPhotoPreview(URL.createObjectURL(blob));
        setTimeout(() => stopCamera(), 300); // Delay to show the flash
      }, 'image/jpeg', 0.9);
    }
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) { toast('Geolocation not supported by your browser', 'error'); return; }
    setLocFeedback("📍 Fetching your location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          if (data && data.display_name) {
            // Use functional update to avoid stale closure overwriting name/phone
            setProfileData(prev => ({ ...prev, location: data.display_name }));
            setLocFeedback("✅ Location updated!");
            setTimeout(() => setLocFeedback(""), 3000);
          } else {
            setLocFeedback("❌ Could not determine address");
          }
        } catch (e) {
          setLocFeedback("❌ Address fetch failed. Check your connection.");
        }
      },
      (err) => {
        if (err.code === 1) setLocFeedback("❌ Permission denied — please allow location access");
        else setLocFeedback("❌ Could not get location");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  
  // Attach camera stream when browser renders the <video> element
  useEffect(() => {
    if (showCamera && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCamera, cameraStream]);

  const saveProfile = async () => {
    setIsProfileSaving(true);
    const fd = new FormData();
    fd.append('name', profileData.name);
    fd.append('location', profileData.location);
    if (profilePhoto) fd.append('profile_photo', profilePhoto);

    try {
      const res = await API.updateFarmerProfile(fd); // Same api endpoint works for both roles
      if (res?.user) {
        login({ ...user, ...res.user }, localStorage.getItem('token'));
        toast('Profile saved successfully!', 'success');
      }
    } catch (e) {
      toast(e.message || 'Failed to save profile', 'error');
    } finally {
      setIsProfileSaving(false);
    }
  };


  if (!user) return null;

  return (
    <>
      <div className="container" style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center', gap: '32px', minHeight: '600px', flexWrap: 'wrap' }}>
        
        {/* SIDEBAR */}
        <aside style={{ width: '260px', flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '32px 20px', textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 16px', background: user.profile_photo ? 'transparent' : 'var(--green-100)', color: 'var(--green-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 600, overflow: 'hidden' }}>
              {user.profile_photo ? (
                <img src={getFullImageUrl(user.profile_photo) || undefined} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (user.name || 'C')[0].toUpperCase()
              )}
            </div>
            <h3 style={{ margin: 0 }}>{user.name || 'Customer'}</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '4px' }}>🛒 {t('i_am_customer')}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: '8px' }}>{user.location || ''}</div>
          </div>

          <nav className="js-hide-mobile" style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
            <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '16px 20px', border: 'none', background: 'var(--green-50)', color: 'var(--green-700)', fontWeight: 600, borderLeft: '3px solid var(--green-500)', cursor: 'pointer', textAlign: 'center' }}>
              👤 {t('my_profile')}
            </button>
          </nav>
        </aside>

        {/* MAIN */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          

          {/* PROFILE PANEL */}
          {activeTab === 'profile' && (
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--gray-100)', textAlign: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{t('my_profile')}</h2>
              </div>
              <div style={{ padding: '32px', maxWidth: '600px' }}>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '8px' }}>{t('full_name')}</label>
                    <input type="text" name="name" value={profileData.name} onChange={handleProfileChange} style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-300)', borderRadius: '8px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '8px' }}>{t('mobile')}</label>
                    <input type="text" value={profileData.phone} readOnly style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px', background: 'var(--gray-50)', color: 'var(--gray-500)' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                   <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '8px' }}>{t('add_profile_photo')}</label>
                   
                   <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                     <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--green-200)', background: 'var(--gray-50)' }}>
                       <img src={photoPreview || getFullImageUrl(user.profile_photo) || undefined} alt="Preview" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <div style={{ display: 'flex', gap: '8px' }}>
                         <button className="btn btn-ghost btn-sm" onClick={() => document.getElementById('dashPhotoInput').click()}>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                           {t('upload')}
                         </button>
                         <button className="btn btn-ghost btn-sm" onClick={startCamera}>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                           {t('take_photo')}
                         </button>
                       </div>
                       <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', margin: 0 }}>{t('img_hint_small')}</p>
                     </div>
                   </div>

                   <input type="file" id="dashPhotoInput" onChange={handlePhotoChange} accept="image/*" style={{ display: 'none' }} />
                   <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                <div style={{ marginBottom: '32px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                     <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--gray-700)' }}>{t('location')}</label>
                     <button className="btn btn-ghost btn-sm" onClick={getUserLocation}>📍 {t('get_location')}</button>
                   </div>
                   <input type="text" name="location" value={profileData.location} onChange={handleProfileChange} placeholder={t('addr_ph')} style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-300)', borderRadius: '8px' }} />
                   {locFeedback && <div style={{ fontSize: '0.8rem', marginTop: '6px', color: locFeedback.includes('✅') ? 'var(--green-600)' : 'var(--red-500)' }}>{locFeedback}</div>}
                </div>

                <button className="btn btn-primary btn-lg" onClick={saveProfile} disabled={isProfileSaving} style={{ padding: '14px 32px', borderRadius: '8px' }}>
                  {isProfileSaving ? t('saving') : t('save_profile')}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </>
  );
};

export default CustomerDashboard;
