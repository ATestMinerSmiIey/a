import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import Index from "./pages/Index.tsx";
import Shop from "./pages/Shop.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Checkout from "./pages/Checkout.tsx";
import OrderStatus from "./pages/OrderStatus.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import SignIn from "./pages/SignIn.tsx";
import SignUp from "./pages/SignUp.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: JSX.Element }) => {
  const { loading, session, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  if (!session) return <Navigate to="/signin" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order/:id" element={<OrderStatus />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;