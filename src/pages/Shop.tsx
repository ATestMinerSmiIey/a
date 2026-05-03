import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useListings } from "@/hooks/useListings";
import { Button } from "@/components/ui/button";
import { ALL_LISTING_CATEGORY_IDS, LISTING_CATEGORIES, type ListingCategoryId } from "@/lib/listingCategories";

// ─── FILTER CONFIG ─────────────────────────────────────────────────────────
// Edit these to add/remove filter categories shown in the sidebar.
const FILTER_CATEGORIES = [
  {
    id: "ships_from",
    label: "Ships from",
    options: ["Worldwide", "United States", "United Kingdom", "Europe", "Asia"],
  },
  {
    id: "price_range",
    label: "Price range",
    options: ["Under $25", "$25 – $100", "$100 – $500", "Over $500"],
  },
  {
    id: "availability",
    label: "Availability",
    options: ["In stock"],
  },
];
// ───────────────────────────────────────────────────────────────────────────

type Filters = Record<string, Set<string>>;

const PRICE_RANGES: Record<string, [number, number]> = {
  "Under $25": [0, 25],
  "$25 – $100": [25, 100],
  "$100 – $500": [100, 500],
  "Over $500": [500, Infinity],
};

const SHOP_CATEGORY_IDS: ListingCategoryId[] = ["thc_pens", "codeine", "general"];

const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { listings } = useListings();

  const categorySearchKey = searchParams.toString();
  const categoryParam = searchParams.get("category");
  const categoryFilter =
    categoryParam && ALL_LISTING_CATEGORY_IDS.includes(categoryParam as ListingCategoryId)
      ? (categoryParam as ListingCategoryId)
      : null;

  const setCategoryFilter = (cat: ListingCategoryId | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!cat) next.delete("category");
        else next.set("category", cat);
        return next;
      },
      { replace: true },
    );
  };

  const toggleFilter = (catId: string, option: string) => {
    setFilters((prev) => {
      const current = new Set(prev[catId] ?? []);
      if (current.has(option)) current.delete(option);
      else current.add(option);
      return { ...prev, [catId]: current };
    });
  };

  const clearAll = () => setFilters({});
  const activeCount = Object.values(filters).reduce((n, s) => n + s.size, 0);
  const categoryActive = categoryFilter !== null;
  const sidebarActiveCount = activeCount + (categoryActive ? 1 : 0);

  const clearAllSidebar = () => {
    setFilters({});
    setCategoryFilter(null);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const params = new URLSearchParams(categorySearchKey);
    const catRaw = params.get("category");
    const catActive =
      catRaw && ALL_LISTING_CATEGORY_IDS.includes(catRaw as ListingCategoryId) ? (catRaw as ListingCategoryId) : null;
    return listings.filter((p) => {
      if (catActive && (p.category ?? "general") !== catActive) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;

      const shipsFrom = filters["ships_from"];
      if (shipsFrom?.size) {
        const match = [...shipsFrom].some((opt) => {
          if (opt === "Worldwide") return true;
          return (p.ships_from ?? "").toLowerCase().includes(opt.toLowerCase());
        });
        if (!match) return false;
      }

      const priceRange = filters["price_range"];
      if (priceRange?.size) {
        const match = [...priceRange].some((opt) => {
          const [min, max] = PRICE_RANGES[opt] ?? [0, Infinity];
          return Number(p.price) >= min && Number(p.price) < max;
        });
        if (!match) return false;
      }

      const avail = filters["availability"];
      if (avail?.has("In stock") && p.stock <= 0) return false;

      return true;
    });
  }, [query, listings, filters, categorySearchKey]);

  const categoryOptionClass = (active: boolean) =>
    `w-full text-left text-sm px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2.5 ${
      active
        ? "bg-primary/15 text-primary border border-primary/40"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
    }`;

  const categoryCheckClass = (active: boolean) =>
    `w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px] font-bold transition-colors ${
      active ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
    }`;

  const SidebarContent = () => (
    <div className="glass-card rounded-2xl p-5 sticky top-24">
      <div className="flex items-center justify-between mb-5">
        <span className="font-display font-semibold text-sm uppercase tracking-wider">Filters</span>
        {sidebarActiveCount > 0 && (
          <button onClick={clearAllSidebar} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>
      <div className="space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Category</div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={categoryOptionClass(!categoryFilter)}
            >
              <span className={categoryCheckClass(!categoryFilter)}>{!categoryFilter ? "✓" : ""}</span>
              All products
            </button>
            {LISTING_CATEGORIES.filter((c) => c.id !== "general").map((c) => {
              const active = categoryFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={categoryOptionClass(active)}
                >
                  <span className={categoryCheckClass(active)}>{active ? "✓" : ""}</span>
                  {c.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCategoryFilter("general")}
              className={categoryOptionClass(categoryFilter === "general")}
            >
              <span className={categoryCheckClass(categoryFilter === "general")}>
                {categoryFilter === "general" ? "✓" : ""}
              </span>
              General
            </button>
          </div>
        </div>

        {FILTER_CATEGORIES.map((cat) => (
          <div key={cat.id}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{cat.label}</div>
            <div className="space-y-1.5">
              {cat.options.map((opt) => {
                const active = filters[cat.id]?.has(opt) ?? false;
                return (
                  <button
                    key={opt}
                    onClick={() => toggleFilter(cat.id, opt)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2.5 ${
                      active
                        ? "bg-primary/15 text-primary border border-primary/40"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px] font-bold transition-colors ${
                      active ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                    }`}>
                      {active && "✓"}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-20">
        {/* Search + mobile filter toggle */}
        <div className="space-y-4 mb-6">
          <div className="glass-card rounded-2xl p-4 md:p-5 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-border focus-visible:ring-primary"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className={`lg:hidden gap-2 border-border/60 shrink-0 ${sidebarActiveCount > 0 ? "border-primary/50 text-primary" : ""}`}
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {sidebarActiveCount > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                  {sidebarActiveCount}
                </span>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Section</span>
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                !categoryFilter ? "bg-primary/15 text-primary border-primary/40" : "text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/50"
              }`}
            >
              All
            </button>
            {LISTING_CATEGORIES.filter((c) => c.id !== "general").map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                  categoryFilter === c.id ? "bg-primary/15 text-primary border-primary/40" : "text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCategoryFilter("general")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                categoryFilter === "general" ? "bg-primary/15 text-primary border-primary/40" : "text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/50"
              }`}
            >
              General
            </button>
          </div>
        </div>

        {/* Mobile sidebar */}
        {sidebarOpen && (
          <div className="lg:hidden mb-6">
            <SidebarContent />
          </div>
        )}

        <div className="flex gap-6 items-start">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <SidebarContent />
          </aside>

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {filtered.length === 0 ? (
              <div className="glass-card rounded-3xl p-16 text-center">
                <p className="font-display text-2xl mb-2">
                  {listings.length === 0 ? "No listings yet" : "No results"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {listings.length === 0
                    ? "New products will be published here soon."
                    : "Try adjusting your search or filters."}
                </p>
                {sidebarActiveCount > 0 && (
                  <button type="button" onClick={clearAllSidebar} className="text-primary text-sm mt-4 hover:underline">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground">
                    {filtered.length} {filtered.length === 1 ? "product" : "products"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filtered.map((p, i) => (
                    <ProductCard
                      key={p.id}
                      product={{
                        id: p.id,
                        name: p.name,
                        price: Number(p.price),
                        priceCrypto: { xmr: "" },
                        image: p.display_image_url || p.image_url || "/placeholder.svg",
                        rating: 5,
                        reviews: 0,
                        seller: "",
                        description: p.description,
                        stock: p.stock,
                      }}
                      index={i}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Shop;
