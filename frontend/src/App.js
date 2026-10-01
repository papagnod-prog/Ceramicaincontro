import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { SamplesProvider } from "@/context/SamplesContext";
import { Header } from "@/components/shop/Header";
import { Footer } from "@/components/shop/Footer";
import { CartDrawer } from "@/components/shop/CartDrawer";
import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import ProductDetail from "@/pages/ProductDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import Checkout from "@/pages/Checkout";
import { PaymentSuccess, PaymentCancel } from "@/pages/PaymentStatus";
import PaymentConfirmation from "@/pages/PaymentConfirmation";
import Account from "@/pages/Account";
import Admin from "@/pages/Admin";
import Samples from "@/pages/Samples";
import QuoteRequest from "@/pages/QuoteRequest";
import TrackOrder from "@/pages/TrackOrder";
import AdminOrderDetail from "@/pages/AdminOrderDetail";
import { Privacy, Cookie, Terms, Withdrawal, LegalNotes, Accessibility } from "@/pages/Legal";
import { SkipLink } from "@/components/shop/SkipLink";

function Shell() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  // Process Emergent Google OAuth callback before anything else
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F6F2]">
      <SkipLink />
      <Header />
      <CartDrawer />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/prodotti" element={<Catalog />} />
          <Route path="/prodotto/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
          <Route path="/payment/confirmation" element={<PaymentConfirmation />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/ordini/:orderId" element={<AdminOrderDetail />} />
          <Route path="/campioni" element={<Samples />} />
          <Route path="/preventivo-progetto" element={<QuoteRequest />} />
          <Route path="/ordine/:orderNumber" element={<TrackOrder />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/cookie" element={<Cookie />} />
          <Route path="/condizioni-di-vendita" element={<Terms />} />
          <Route path="/recesso" element={<Withdrawal />} />
          <Route path="/note-legali" element={<LegalNotes />} />
          <Route path="/accessibilita" element={<Accessibility />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter basename="/store">
      <AuthProvider>
        <CartProvider>
          <SamplesProvider>
            <Shell />
            <Toaster position="top-center" richColors />
          </SamplesProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
