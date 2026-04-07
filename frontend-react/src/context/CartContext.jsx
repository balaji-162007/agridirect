import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCartState] = useState(() => {
    return JSON.parse(localStorage.getItem('agri_cart') || '[]');
  });
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('agri_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, quantity = 1) => {
    setCartState(prev => {
      const idx = prev.findIndex(item => item.id === product.id);
      if (idx > -1) {
        return prev.map((item, i) => 
          i === idx ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
    setCartDrawerOpen(true);
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartState(prev => prev.map(item => 
      item.id === productId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const removeFromCart = (productId) => {
    setCartState(prev => prev.filter(item => item.id !== productId));
  };

  const clearCart = () => setCartState([]);

  const toggleCartDrawer = () => setCartDrawerOpen(!cartDrawerOpen);

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || item.qty || 1)), 0);

  // Aliases for compatibility with Cart.jsx
  const cartItems = cart.map(item => ({...item, qty: item.quantity || item.qty || 1}));
  const updateCartItem = (productId, newQuantity) => updateQuantity(productId, newQuantity);

  return (
    <CartContext.Provider value={{ 
      cart, 
      cartItems,
      cartSubtotal,
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      updateCartItem,
      clearCart,
      cartDrawerOpen,
      setCartDrawerOpen,
      toggleCartDrawer
    }}>
      {children}
    </CartContext.Provider>
  );
};
