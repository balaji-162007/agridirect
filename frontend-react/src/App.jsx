import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import MobileNav from './components/MobileNav';

import Home from './pages/Home';
import Products from './pages/Products';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import CustomerDashboard from './pages/CustomerDashboard';
import FarmerDashboard from './pages/FarmerDashboard';
import ProductDetail from './pages/ProductDetail';
import LoginPage from './pages/LoginPage';
import Orders from './pages/Orders';

import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './components/Toast';

// Redirect farmers from consumer pages to their dashboard
const ConsumerRoute = ({ children }) => {
  const { isFarmer } = useAuth();
  if (isFarmer) {
    return <Navigate to="/farmer-dashboard.html" replace />;
  }
  return children;
};

const ConditionalFooter = () => {
  const location = useLocation();
  const isHomePage = location.pathname === '/' || location.pathname === '/index.html';
  return isHomePage ? <Footer /> : null;
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <Router>
              <NavBar />
              <main style={{ minHeight: '80vh' }}>
                <Routes>
                  <Route path="/" element={<ConsumerRoute><Home /></ConsumerRoute>} />
                  <Route path="/index.html" element={<ConsumerRoute><Home /></ConsumerRoute>} />
                  <Route path="/products.html" element={<ConsumerRoute><Products /></ConsumerRoute>} />
                  <Route path="/product/:id" element={<ConsumerRoute><ProductDetail /></ConsumerRoute>} />
                  <Route path="/cart.html" element={<ConsumerRoute><Cart /></ConsumerRoute>} />
                  <Route path="/checkout.html" element={<ConsumerRoute><Checkout /></ConsumerRoute>} />
                  <Route path="/customer-dashboard.html" element={<CustomerDashboard />} />
                  <Route path="/farmer-dashboard.html" element={<FarmerDashboard />} />
                  <Route path="/login.html" element={<LoginPage />} />
                  <Route path="/orders.html" element={<Orders />} />
                </Routes>
              </main>
              <ConditionalFooter />
              <MobileNav />
            </Router>
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
