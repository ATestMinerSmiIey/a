import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag, User, Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

const Navbar = () => {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { session, isAdmin, signOut } = useAuth();
  const { count } = useCart();

  const links = [
    { to: "/shop", label: "Marketplace" },
    ...(isAdmin ? [{ to: "/dashboard", label: "Dashboard" }] : []),
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/40">
      <nav className="container mx-auto grid grid-cols-3 items-center h-16 px-4">
        <div />

        <div className="hidden md:flex items-center justify-center gap-8">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-medium transition-colors duration-300 hover:text-primary relative ${
                pathname === l.to ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {l.label}
              {pathname === l.to && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-primary rounded-full" />
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="ghost" size="icon" className="hover:text-primary hover:bg-primary/10 relative">
            <Link to="/checkout" aria-label="Cart">
              <ShoppingBag className="h-4 w-4" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {count}
                </span>
              )}
            </Link>
          </Button>
          {session ? (
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); nav("/"); }} className="hidden sm:flex border-primary/40 hover:bg-primary/10 hover:border-primary hover:text-primary">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          ) : (
            <div className="hidden sm:flex items-center gap-1">
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/10">
                <Link to="/signup">Sign up</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-primary/40 hover:bg-primary/10 hover:border-primary hover:text-primary">
                <Link to="/signin"><User className="h-4 w-4 mr-2" /> Sign in</Link>
              </Button>
            </div>
          )}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;

