import { Link } from "react-router-dom";

const ACCOUNT_HREFS: Record<string, string> = {
  "Sign in": "/signin",
  Register: "/signup",
};

const Footer = () => {
  return (
    <footer className="border-t border-border/40 mt-24 py-12">
      <div className="container mx-auto px-4 grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="font-display font-semibold tracking-[0.2em]">HISUPPLY</span>
          </div>
          <p className="text-sm text-muted-foreground">The private marketplace for premium goods. Pay with crypto, ship worldwide.</p>
        </div>
        {[
          { title: "Marketplace", items: ["Browse", "Categories", "Sellers", "New arrivals"] },
          { title: "Account", items: ["Sign in", "Register", "Orders", "Wallet"] },
          { title: "Support", items: ["Help center", "Escrow", "Privacy", "Terms"] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="font-display font-semibold mb-3 text-sm">{col.title}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {col.items.map((i) => (
                <li key={i}>
                  {ACCOUNT_HREFS[i] && col.title === "Account" ? (
                    <Link to={ACCOUNT_HREFS[i]} className="hover:text-primary transition-colors">
                      {i}
                    </Link>
                  ) : (
                    <span className="hover:text-primary transition-colors cursor-pointer">{i}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container mx-auto px-4 mt-10 pt-6 border-t border-border/40 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
        <span>© {new Date().getFullYear()} HiSupply. All rights reserved.</span>
        <span>Crypto only</span>
      </div>
    </footer>
  );
};

export default Footer;
