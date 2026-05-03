import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useListings } from "@/hooks/useListings";
import { LISTING_CATEGORIES, type ListingCategoryId } from "@/lib/listingCategories";

const HOME_SECTIONS: ListingCategoryId[] = ["thc_edibles", "thc_pens", "codeine", "codeine_syrup"];

const SECTION_TAGLINES: Partial<Record<ListingCategoryId, string>> = {
  thc_edibles: "Gummies, chocolates, and infused treats from verified sellers.",
  thc_pens: "Vaporizers and cartridges. Browse verified listings.",
  codeine: "Tablets and pharma-grade inventory from trusted sellers.",
  codeine_syrup: "Syrup formats — browse verified listings.",
};

const Index = () => {
  const { listings } = useListings();

  const toCardProduct = (p: (typeof listings)[number], index: number) => (
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
      index={index}
    />
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />

        {HOME_SECTIONS.map((catId) => {
          const meta = LISTING_CATEGORIES.find((c) => c.id === catId)!;
          const items = listings.filter((l) => (l.category ?? "general") === catId);

          return (
            <section key={catId} className="container mx-auto px-4 py-20 border-b border-border/30 last:border-b-0">
              <div className="flex items-end justify-between gap-4 mb-10">
                <div>
                  <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">{meta.sectionTitle}</h2>
                  <p className="text-muted-foreground text-sm mt-2 max-w-lg">
                    {SECTION_TAGLINES[catId] ?? "Browse verified listings."}
                  </p>
                </div>
                <Button asChild variant="ghost" className="group hover:text-primary hover:bg-primary/5 shrink-0">
                  <Link to={`/shop?category=${catId}`}>
                    View all <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="glass-card rounded-3xl p-12 text-center">
                  <p className="text-muted-foreground text-sm">No listings in this section yet.</p>
                  <Button asChild variant="outline" className="mt-4 border-primary/40">
                    <Link to="/shop">Browse marketplace</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.slice(0, 6).map((p, i) => toCardProduct(p, i))}
                </div>
              )}
            </section>
          );
        })}
      </main>
      <Footer />
    </div>
  );
};

export default Index;
