import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API } from '../services/api';

// Utility for Distance Calculation
const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || isNaN(lat2) || isNaN(lon2)) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';

const Checkout = () => {
  console.log("Checkout component loaded - Fix V2");
  const navigate = useNavigate();
  const { cartItems, cartSubtotal, clearCart } = useCart();
  const { user, isLoggedIn } = useAuth();
  const { t, currentLang } = useLanguage();

  const [step, setStep] = useState(1);
  const [address, setAddress] = useState({
    name: '', phone: '', line1: '', line2: '', city: '', state: 'TN', pin: '', lat: null, lng: null
  });
  const [deliveryMethod, setDeliveryMethod] = useState('farmer_delivery');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [onlineMode, setOnlineMode] = useState('upi');

  const [farmerSettings, setFarmerSettings] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [coordsFeedback, setCoordsFeedback] = useState('Location helps calculate accurate farmer delivery fees.');
  const [orderSuccessId, setOrderSuccessId] = useState(null);
  const [orderTimestamp, setOrderTimestamp] = useState(null);
  
  // Delivery Slots
  const [deliveryDate, setDeliveryDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Delivery Costs
  const [farmerDelCost, setFarmerDelCost] = useState(0);
  const [isFarmerEligible, setIsFarmerEligible] = useState(true);
  const [farmerMsg, setFarmerMsg] = useState('');

  const [localDelCost, setLocalDelCost] = useState(0);
  const [isLocalEligible, setIsLocalEligible] = useState(true);
  const [localMsg, setLocalMsg] = useState('');

  useEffect(() => {
    if (!isLoggedIn) {
      // Redirect to login or open modal. Let's just alert for now.
      // Should ideally open modal
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (user) {
      setAddress((prev) => ({
        ...prev,
        name: user.name || prev.name,
        phone: (user.phone || '').replace('+91', '') || prev.phone
      }));
    }
    const farmerId = cartItems[0]?.farmer_id;
    if (farmerId) {
      API.getFarmerProfile(farmerId).then(data => {
        if (data?.farmer) setFarmerSettings(data.farmer);
      }).catch(err => console.error(err));
    }
  }, [user, cartItems]);

  useEffect(() => {
    // Load Razorpay Script conditionally
    if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      const script = document.createElement('script');
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Initialize delivery date based on 6PM cutoff
  useEffect(() => {
    const now = new Date();
    const cutoff = 18; // 6 PM
    let startDate = new Date();
    if (now.getHours() >= cutoff) {
      startDate.setDate(now.getDate() + 2);
    } else {
      startDate.setDate(now.getDate() + 1);
    }
    const isoDate = startDate.toISOString().split('T')[0];
    setDeliveryDate(isoDate);
  }, []);

  // Fetch slots when date changes
  useEffect(() => {
    if (deliveryDate) {
      setIsLoadingSlots(true);
      API.getDeliverySlots(deliveryDate)
        .then(res => {
          setAvailableSlots(res.slots || []);
          // Auto-select first available slot if none selected or if previously selected is now unavailable
          const firstAvail = res.slots?.find(s => s.is_available);
          if (firstAvail && !res.slots.find(s => s.slot_id === selectedSlotId)?.is_available) {
            setSelectedSlotId(firstAvail.slot_id);
          }
        })
        .catch(err => console.error("Error fetching slots:", err))
        .finally(() => setIsLoadingSlots(false));
    }
  }, [deliveryDate]);

  useEffect(() => {
    const totalQty = cartItems.reduce((s, i) => s + i.qty, 0);
    const lat2 = address.lat;
    const lng2 = address.lng;

    // 1. Manual Entry Fallback (No GPS)
    const MIN_QTY_LOCAL = 15;
    if (lat2 === null || lng2 === null) {
      const FARMER_BASE_FEE = 20, PER_KG_FARMER = 2, MANUAL_PREMIUM_FARMER = 50;
      const LOCAL_BASE_FEE = 30, PER_KG_LOCAL = 3, MANUAL_PREMIUM_LOCAL = 70;

      setIsFarmerEligible(true);
      setFarmerDelCost(FARMER_BASE_FEE + (totalQty * PER_KG_FARMER) + MANUAL_PREMIUM_FARMER);
      setFarmerMsg('📍 Dynamic fee applied (GPS not provided).');

      if (totalQty < MIN_QTY_LOCAL) {
        setIsLocalEligible(false);
        setLocalMsg(`⚠️ Add ${(MIN_QTY_LOCAL - totalQty).toFixed(1)} kg more to unlock.`);
        if (deliveryMethod === 'local_partner') setDeliveryMethod('pickup');
      } else {
        setIsLocalEligible(true);
        setLocalDelCost(LOCAL_BASE_FEE + (totalQty * PER_KG_LOCAL) + MANUAL_PREMIUM_LOCAL);
        setLocalMsg('Dynamic fee applied (GPS not provided).');
      }
      return;
    }

    // 2. Fetch Farmer Settings (Distance-based)
    if (!farmerSettings) return;
    const lat1 = farmerSettings.latitude;
    const lng1 = farmerSettings.longitude;

    // Farmer Eligibility
    if (!lat1 || !lng1 || (Math.abs(lat1) < 0.1 && Math.abs(lng1) < 0.1)) {
      setIsFarmerEligible(false);
      setFarmerMsg('⚠️ Farmer has not set their location yet. Self delivery is currently unavailable.');
      if (deliveryMethod === 'farmer_delivery') setDeliveryMethod('local_partner');
    } else {
      const dist = calculateHaversine(lat1, lng1, lat2, lng2);
      const maxDist = farmerSettings.max_delivery_distance || 10;
      const maxCap = 15;
      const allowedQty = maxCap * (1 - (dist / maxDist));

      if (totalQty > maxCap) {
        setIsFarmerEligible(false);
        setFarmerMsg(`Reduce quantity: Order exceeds farmer's maximum carrying capacity (${maxCap} kg).`);
        if (deliveryMethod === 'farmer_delivery') setDeliveryMethod('local_partner');
      } else if (dist > maxDist) {
        setIsFarmerEligible(false);
        setFarmerMsg(`Delivery not available: Address is beyond farmer's maximum delivery distance (${maxDist} km).`);
        if (deliveryMethod === 'farmer_delivery') setDeliveryMethod('local_partner');
      } else if (totalQty > allowedQty) {
        setIsFarmerEligible(false);
        setFarmerMsg(`Reduce quantity: For your location (${dist.toFixed(1)} km), max qty is ${allowedQty.toFixed(1)} kg.`);
        if (deliveryMethod === 'farmer_delivery') setDeliveryMethod('local_partner');
      } else {
        setIsFarmerEligible(true);
        const base = 20, perKm = 5, perKg = 2;
        setFarmerDelCost(base + (dist * perKm) + (totalQty * perKg));
        setFarmerMsg(`✅ Available! Distance: ${dist.toFixed(1)} km.`);
      }
    }

    // Local Partner Eligibility
    const MIN_QTY = 15;
    if (totalQty < MIN_QTY) {
      setIsLocalEligible(false);
      setLocalMsg(`⚠️ Add ${(MIN_QTY - totalQty).toFixed(1)} kg more to unlock.`);
      if (deliveryMethod === 'local_partner') setDeliveryMethod('pickup');
    } else {
      const dist = calculateHaversine(lat1, lng1, lat2, lng2);
      const MAX_DIST = 15;
      if (dist > MAX_DIST) {
        setIsLocalEligible(false);
        setLocalMsg(`❌ Beyond local delivery range (${dist.toFixed(1)} km).`);
        if (deliveryMethod === 'local_partner') setDeliveryMethod('pickup');
      } else {
        setIsLocalEligible(true);
        const BASE_FEE = 30, PER_KM = 6, PER_KG = 3;
        setLocalDelCost(BASE_FEE + (dist * PER_KM) + (totalQty * PER_KG));
        setLocalMsg(`Distance: ${dist.toFixed(1)} km`);
      }
    }
  }, [address.lat, address.lng, farmerSettings, cartItems, deliveryMethod]);

  const handleAddressChange = (e) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const getUserCoordinates = () => {
    if (!navigator.geolocation) {
      setCoordsFeedback('Geolocation not supported by your browser.');
      return;
    }
    setCoordsFeedback('⌛ Fetching coordinates and address...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setAddress(prev => ({ ...prev, lat, lng }));
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'User-Agent': 'AgriDirect-App' }
          });
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            const line1Parts = [];
            if (addr.road) line1Parts.push(addr.road);
            if (addr.suburb) line1Parts.push(addr.suburb);
            if (addr.neighbourhood) line1Parts.push(addr.neighbourhood);
            
            setAddress(prev => ({
              ...prev,
              line1: line1Parts.join(', ') || addr.amenity || prev.line1,
              city: addr.city || addr.town || addr.village || addr.county || prev.city,
              pin: addr.postcode || prev.pin
            }));
            setCoordsFeedback('✅ Location and address captured automatically!');
          } else {
            setCoordsFeedback(`✅ Coordinates captured: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch (e) {
          setCoordsFeedback(`✅ Coordinates captured: ${lat.toFixed(4)}, ${lng.toFixed(4)} (Address failed)`);
        }
      },
      () => {
        setCoordsFeedback('❌ Could not get location. Please enter address manually.');
      }
    );
  };

  const validateAddress = () => {
    if (!address.name || !address.phone || !address.line1 || !address.city || !address.pin) {
      alert('Please fill all required fields');
      return false;
    }
    if (!/^\d{6}$/.test(address.pin.trim())) { alert('Pincode must be 6 digits'); return false; }
    if (!/^\d{10}$/.test(address.phone.trim())) { alert('Enter a valid 10-digit phone number'); return false; }
    return true;
  };

  const handleNextStep = (nextStep) => {
    if (nextStep === 2 && !validateAddress()) return;
    setStep(nextStep);
  };

  const currentDelCharge = deliveryMethod === 'local_partner' ? localDelCost : (deliveryMethod === 'farmer_delivery' ? farmerDelCost : 0);
  const grandTotal = cartSubtotal + currentDelCharge;

  const handlePlaceOrder = async () => {
    if (!validateAddress()) return;
    setIsProcessing(true);

    const payload = {
      items: cartItems.map(i => ({ product_id: i.id || i.product_id, qty: i.qty, price: i.price })),
      delivery_address: {
        name: address.name.trim(),
        phone: '+91' + address.phone.trim(),
        line1: address.line1.trim(),
        line2: address.line2.trim(),
        city: address.city.trim(),
        state: address.state,
        pincode: address.pin.trim(),
        latitude: address.lat,
        longitude: address.lng,
      },
      delivery_method: deliveryMethod,
      payment_method: paymentMethod,
      subtotal: cartSubtotal,
      delivery_charge: currentDelCharge,
      total: grandTotal,
      delivery_date: deliveryDate,
      slot_id: selectedSlotId,
    };

    try {
      if (paymentMethod === 'cod') {
        const res = await API.createOrder(payload);
        if (res?.order_id) { 
          setOrderSuccessId(res.order_id); 
          setOrderTimestamp(new Date().toISOString());
          clearCart(); 
        }
      } else {
        const rzp = await API.createPaymentOrder(grandTotal);
        if (!rzp || !rzp.razorpay_order_id) throw new Error('Could not create payment order');

        const opts = {
          key: rzp.key_id,
          amount: rzp.amount,
          currency: 'INR',
          name: 'AgriDirect',
          description: 'Fresh Farm Produce',
          order_id: rzp.razorpay_order_id,
          prefill: { name: payload.delivery_address.name, contact: payload.delivery_address.phone },
          theme: { color: '#38a169' },
          handler: async function(r) {
            const vPayload = { ...payload,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_order_id: r.razorpay_order_id,
              razorpay_signature: r.razorpay_signature,
            };
            const res = await API.verifyPayment(vPayload);
            if (res?.order_id) { 
              setOrderSuccessId(res.order_id); 
              setOrderTimestamp(new Date().toISOString());
              clearCart(); 
            }
            else alert('Payment verification failed');
          },
          modal: { ondismiss: () => setIsProcessing(false) }
        };
        const rzpObj = new window.Razorpay(opts);
        rzpObj.open();
        return; // wait for handler
      }
    } catch (err) {
      alert(err.message || 'Failed to place order');
    }
    setIsProcessing(false);
  };

  if (cartItems.length === 0 && !orderSuccessId) {
    return (
      <div className="container section" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2>Your cart is empty</h2>
        <Link to="/products.html" className="btn btn-primary mt-16">Browse Products</Link>
      </div>
    );
  }

  if (orderSuccessId) {
    return (
      <div className="container section" style={{ maxWidth: '640px', marginTop: '40px' }}>
        <div className="order-success" style={{ textAlign: 'center', background: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
          <h2>Order placed successfully!</h2>
          <div style={{ margin: '24px auto 12px', padding: '12px 24px', background: 'var(--green-50)', color: 'var(--green-800)', borderRadius: '8px', display: 'inline-block', fontWeight: 700, fontSize: '1.2rem' }}>
            #{orderSuccessId}
          </div>
          <div id="successOrderTime" style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginBottom: '24px' }}>
            {t('order_time')}: {fmtDateTime(orderTimestamp)}
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '24px' }}>
            <Link to="/orders.html" className="btn btn-primary" style={{ background: 'var(--green-600)', borderColor: 'var(--green-700)' }}>📦 Track Order</Link>
            <Link to="/" className="btn btn-ghost">🏠 Home</Link>
            <Link to="/products.html" className="btn btn-ghost">🛍️ Shop More</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="container page-header-inner">
          <div className="breadcrumb">
            <Link to="/">Home</Link><span>›</span>
            <Link to="/cart.html">Cart</Link><span>›</span>
            <span>Checkout</span>
          </div>
          <h1>Checkout</h1>
        </div>
      </div>

      <div className="container checkout-main-grid">
        <div>
          {/* Step 1 */}
          <div className={`checkout-step ${step >= 1 ? 'active' : ''}`} style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', marginBottom: '20px', background: '#fff', overflow: 'hidden' }}>
            <div className="checkout-step-head" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', borderBottom: step === 1 ? '1px solid var(--gray-100)' : 'none' }} onClick={() => setStep(1)}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: step > 1 ? 'var(--green-500)' : 'var(--green-100)', color: step > 1 ? '#fff' : 'var(--green-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                {step > 1 ? '✓' : '1'}
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Delivery Address</h4>
            </div>
            {step === 1 && (
              <div style={{ padding: '24px' }}>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Full Name <span style={{color:'red'}}>*</span></label>
                    <input type="text" className="form-input" name="name" value={address.name} onChange={handleAddressChange} placeholder="Your full name" style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mobile <span style={{color:'red'}}>*</span></label>
                    <div style={{ display: 'flex', border: '1px solid var(--gray-200)', borderRadius: '8px', overflow: 'hidden' }}>
                      <span style={{ padding: '12px', background: 'var(--gray-50)', borderRight: '1px solid var(--gray-200)', color: 'var(--gray-600)' }}>🇮🇳 +91</span>
                      <input type="tel" name="phone" value={address.phone} onChange={handleAddressChange} maxLength="10" placeholder="10-digit number" style={{ flex: 1, padding: '12px', border: 'none', outline: 'none' }} />
                    </div>
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">Address Line 1 <span style={{color:'red'}}>*</span></label>
                  <input type="text" className="form-input" name="line1" value={address.line1} onChange={handleAddressChange} placeholder="House no, Street name" style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px' }} />
                </div>
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">Address Line 2</label>
                  <input type="text" className="form-input" name="line2" value={address.line2} onChange={handleAddressChange} placeholder="Landmark, area (optional)" style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px' }} />
                </div>
                <div className="form-row-3" style={{ marginTop: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">City <span style={{color:'red'}}>*</span></label>
                    <input type="text" className="form-input" name="city" value={address.city} onChange={handleAddressChange} style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select className="form-input" name="state" value={address.state} onChange={handleAddressChange} style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px', backgroundColor: '#fff' }}>
                      <option value="TN">Tamil Nadu</option>
                      <option value="KA">Karnataka</option>
                      <option value="KL">Kerala</option>
                      <option value="MH">Maharashtra</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pincode <span style={{color:'red'}}>*</span></label>
                    <input type="text" className="form-input" name="pin" value={address.pin} onChange={handleAddressChange} maxLength="6" style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px' }} />
                  </div>
                </div>

                <div style={{ marginTop: '16px', padding: '16px', background: 'var(--green-50)', border: '1px dashed var(--green-300)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--green-800)' }}>📍 Accurate Location for Delivery</div>
                    <button type="button" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={getUserCoordinates}>
                      Get Location
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginTop: '8px' }}>{coordsFeedback}</div>
                </div>

                <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={() => handleNextStep(1.5)}>Next →</button>
              </div>
            )}
          </div>

          {/* Step 1.5: Delivery Schedule */}
          <div className={`checkout-step ${step >= 1.5 ? 'active' : ''}`} style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', marginBottom: '20px', background: '#fff', overflow: 'hidden', opacity: step < 1.5 ? 0.6 : 1, pointerEvents: step < 1.5 ? 'none' : 'auto' }}>
            <div className="checkout-step-head" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: step >= 1.5 ? 'pointer' : 'default', borderBottom: step === 1.5 ? '1px solid var(--gray-100)' : 'none' }} onClick={() => { if (step >= 1.5) setStep(1.5); }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: step > 1.5 ? 'var(--green-500)' : 'var(--green-100)', color: step > 1.5 ? '#fff' : 'var(--green-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                {step > 1.5 ? '✓' : '1.5'}
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{t('delivery_schedule')}</h4>
            </div>
            {step === 1.5 && (
              <div style={{ padding: '24px' }}>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label">{t('delivery_date_label')}</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={deliveryDate} 
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    style={{ width: '100%', padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px' }}
                  />
                </div>

                <label className="form-label">{t('select_slot')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginTop: '8px' }}>
                  {isLoadingSlots ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px' }}>{t('loading')}</div>
                  ) : availableSlots.map(s => (
                    <div 
                      key={s.slot_id}
                      onClick={() => s.is_available && setSelectedSlotId(s.slot_id)}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: `2px solid ${selectedSlotId === s.slot_id ? 'var(--green-500)' : 'var(--gray-200)'}`,
                        background: selectedSlotId === s.slot_id ? 'var(--green-50)' : '#fff',
                        cursor: s.is_available ? 'pointer' : 'not-allowed',
                        opacity: s.is_available ? 1 : 0.6,
                        position: 'relative',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {s.name === 'Morning' ? '☀️' : s.name === 'Afternoon' ? '🌤️' : '🌙'} {t(s.name.toLowerCase())}
                          </span>
                          {s.name === 'Morning' && (
                            <span style={{ fontSize: '0.6rem', background: 'var(--amber-100)', color: 'var(--amber-800)', padding: '2px 4px', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                              {t('recommended')}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.start_time} - {s.end_time}
                        </div>
                        
                        {!s.is_available ? (
                           <div style={{ fontSize: '0.7rem', color: 'var(--red-600)', marginTop: '4px', fontWeight: 600 }}>
                              {s.status === 'full' ? t('slot_full') : t('slot_closed')}
                           </div>
                        ) : (
                          <div style={{ fontSize: '0.7rem', color: 'var(--green-600)', marginTop: '4px', fontWeight: 600 }}>
                            {t('available')}
                          </div>
                        )}
                      </div>

                      {selectedSlotId === s.slot_id && (
                        <div style={{ position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px', background: 'var(--green-500)', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✓</div>
                      )}
                    </div>
                  ))}
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: '24px' }} 
                  onClick={() => selectedSlotId && setStep(2)}
                  disabled={!selectedSlotId}
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className={`checkout-step ${step >= 2 ? 'active' : ''}`} style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', marginBottom: '20px', background: '#fff', overflow: 'hidden', opacity: step < 2 ? 0.6 : 1, pointerEvents: step < 2 ? 'none' : 'auto' }}>
            <div className="checkout-step-head" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: step >= 2 ? 'pointer' : 'default', borderBottom: step === 2 ? '1px solid var(--gray-100)' : 'none' }} onClick={() => { if (step >= 2) setStep(2); }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: step > 2 ? 'var(--green-500)' : 'var(--green-100)', color: step > 2 ? '#fff' : 'var(--green-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                {step > 2 ? '✓' : '2'}
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Delivery Method</h4>
            </div>
            {step === 2 && (
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div style={{ padding: '16px', border: `2px solid ${deliveryMethod === 'farmer_delivery' ? 'var(--green-500)' : 'var(--gray-200)'}`, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', cursor: isFarmerEligible ? 'pointer' : 'not-allowed', opacity: isFarmerEligible ? 1 : 0.5 }} onClick={() => isFarmerEligible && setDeliveryMethod('farmer_delivery')}>
                    <input type="radio" checked={deliveryMethod === 'farmer_delivery'} readOnly style={{ accentColor: 'var(--green-600)', transform: 'scale(1.2)' }} />
                    <div style={{ fontSize: '2rem' }}>🚜</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Farmer Self Delivery</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '4px' }}>{farmerMsg || 'Direct from farm'}</div>
                    </div>
                    {isFarmerEligible && <div style={{ fontWeight: 700, color: 'var(--green-700)' }}>₹{farmerDelCost.toFixed(2)}</div>}
                  </div>

                  <div style={{ padding: '16px', border: `2px solid ${deliveryMethod === 'local_partner' ? 'var(--green-500)' : 'var(--gray-200)'}`, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', cursor: isLocalEligible ? 'pointer' : 'not-allowed', opacity: isLocalEligible ? 1 : 0.5 }} onClick={() => isLocalEligible && setDeliveryMethod('local_partner')}>
                    <input type="radio" checked={deliveryMethod === 'local_partner'} readOnly style={{ accentColor: 'var(--green-600)', transform: 'scale(1.2)' }} />
                    <div style={{ fontSize: '2rem' }}>🛵</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Local Delivery Partner</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '4px' }}>{localMsg || 'Same / next day delivery'}</div>
                    </div>
                    {isLocalEligible && <div style={{ fontWeight: 700 }}>₹{localDelCost.toFixed(2)}</div>}
                  </div>

                  <div style={{ padding: '16px', border: `2px solid ${deliveryMethod === 'pickup' ? 'var(--green-500)' : 'var(--gray-200)'}`, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }} onClick={() => setDeliveryMethod('pickup')}>
                    <input type="radio" checked={deliveryMethod === 'pickup'} readOnly style={{ accentColor: 'var(--green-600)', transform: 'scale(1.2)' }} />
                    <div style={{ fontSize: '2rem' }}>🏠</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Pickup from Farm</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '4px' }}>Collect at farm location</div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--green-700)' }}>FREE</div>
                  </div>

                </div>
                <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={() => handleNextStep(3)}>Next →</button>
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div className={`checkout-step ${step >= 3 ? 'active' : ''}`} style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', background: '#fff', overflow: 'hidden', opacity: step < 3 ? 0.6 : 1, pointerEvents: step < 3 ? 'none' : 'auto' }}>
            <div className="checkout-step-head" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: step >= 3 ? 'pointer' : 'default', borderBottom: step === 3 ? '1px solid var(--gray-100)' : 'none' }} onClick={() => { if (step >= 3) setStep(3); }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: step > 3 ? 'var(--green-500)' : 'var(--green-100)', color: step > 3 ? '#fff' : 'var(--green-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                3
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Payment Method</h4>
            </div>
            {step === 3 && (
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div style={{ padding: '16px', border: `2px solid ${paymentMethod === 'cod' ? 'var(--green-500)' : 'var(--gray-200)'}`, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }} onClick={() => setPaymentMethod('cod')}>
                    <input type="radio" checked={paymentMethod === 'cod'} readOnly style={{ accentColor: 'var(--green-600)', transform: 'scale(1.2)' }} />
                    <div style={{ fontSize: '2rem' }}>💵</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>Cash on Delivery</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '4px' }}>Pay when you receive the order</div>
                    </div>
                  </div>

                  <div style={{ padding: '16px', border: `2px solid ${paymentMethod === 'online' ? 'var(--green-500)' : 'var(--gray-200)'}`, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }} onClick={() => setPaymentMethod('online')}>
                    <input type="radio" checked={paymentMethod === 'online'} readOnly style={{ accentColor: 'var(--green-600)', transform: 'scale(1.2)' }} />
                    <div style={{ fontSize: '2rem' }}>💳</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Online Payment</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '4px' }}>UPI, Cards, Net Banking</div>
                    </div>
                    <div style={{ fontSize: '0.7rem', background: 'var(--green-100)', color: 'var(--green-800)', padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>🔒 SECURE</div>
                  </div>

                  {paymentMethod === 'online' && (
                    <div style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: '12px', border: '1px solid var(--gray-200)' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>Choose Mode:</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button className={`btn ${onlineMode === 'upi' ? 'btn-secondary' : 'btn-ghost'}`} style={{ padding: '6px 14px' }} onClick={() => setOnlineMode('upi')}>📱 UPI</button>
                        <button className={`btn ${onlineMode === 'card' ? 'btn-secondary' : 'btn-ghost'}`} style={{ padding: '6px 14px' }} onClick={() => setOnlineMode('card')}>💳 Card</button>
                        <button className={`btn ${onlineMode === 'netbanking' ? 'btn-secondary' : 'btn-ghost'}`} style={{ padding: '6px 14px' }} onClick={() => setOnlineMode('netbanking')}>🏦 Net Banking</button>
                      </div>
                    </div>
                  )}

                </div>

                <button className="btn btn-primary btn-full btn-lg mt-24" onClick={handlePlaceOrder} disabled={isProcessing} style={{ width: '100%', padding: '16px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, marginTop: '32px' }}>
                  {isProcessing ? 'Processing...' : '🛒 Place Order'}
                </button>
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: '16px' }}>
                  🔒 Payments secured by Razorpay. We don't store card details.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order Summary Right Panel */}
        <div className="checkout-summary-container">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Order Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '300px', overflowY: 'auto' }}>
            {cartItems.map(item => (
              <div key={item.id || item.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid var(--gray-100)', paddingBottom: '12px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', overflowWrap: 'break-word' }}>
                    {currentLang === 'ta' && item.name_ta ? item.name_ta : item.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{item.qty} × ₹{item.price}</div>
                </div>
                <div style={{ fontWeight: 700, flexShrink: 0, textAlign: 'right' }}>₹{(item.price * item.qty).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '16px', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.95rem' }}>
              <span className="text-muted">Subtotal</span>
              <span style={{ fontWeight: 600 }}>₹{cartSubtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.95rem' }}>
              <span className="text-muted">Delivery</span>
              <span style={{ fontWeight: 600 }}>{currentDelCharge === 0 ? <span style={{color:'var(--green-600)'}}>Free</span> : `₹${currentDelCharge.toFixed(2)}`}</span>
            </div>
            <div style={{ borderTop: '1px dashed var(--gray-200)', margin: '16px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, color: 'var(--green-800)' }}>
              <span>Total</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <div style={{ marginTop: '24px', padding: '12px', background: 'var(--green-50)', color: 'var(--green-800)', fontSize: '0.85rem', borderRadius: '8px', textAlign: 'center', fontWeight: '500' }}>
            🌿 Buying directly from the farmer — no middlemen!
          </div>

          {selectedSlotId && (
            <div style={{ marginTop: '16px', padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid var(--gray-200)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '8px' }}>🚀 {t('delivery_schedule')}</div>
              <div style={{ fontWeight: 700, color: 'var(--green-700)' }}>
                {new Date(deliveryDate).toLocaleDateString(currentLang === 'ta' ? 'ta-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                <br />
                {availableSlots.find(s => s.slot_id === selectedSlotId)?.name} ({availableSlots.find(s => s.slot_id === selectedSlotId)?.start_time} - {availableSlots.find(s => s.slot_id === selectedSlotId)?.end_time})
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Checkout;
