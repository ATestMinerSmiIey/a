import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useListings } from "@/hooks/useListings";
import { useCart } from "@/hooks/useCart";
import { products } from "@/data/products";

const ProductDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { listings, loading: listingsLoading } = useListings();
  const { add } = useCart();
  const listing = listings.find((p) => p.id === id);
  const fallback = !listing ? products.find((p) => p.id === id) : null;

  const [selectedFlavor, setSelectedFlavor] = useState<string>("");

  // Parse flavors from the listing (newline-separated)
  const flavors = listing?.flavors 
    ? listing.flavors.split("\n").map(f => f.trim()).filter(Boolean) 
    : [];
  const requiresFlavor = flavors.length > 0;

  const product = listing
    ? {
        id: listing.id,
        name: listing.name,
        price: Number(listing.price),
        image: listing.display_image_url || listing.image_url || "/placeholder.svg",
        description: listing.description,
        stock: listing.stock,
        ships_from: listing.ships_from || "",
      }
    : fallback
      ? { ...fallback, ships_from: "" }
      : null;

  if (!product && listingsLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }

  if (!product) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 pt-32 text-center">
          <h1 className="font-display text-3xl">Product not found</h1>
          <Link to="/shop" className="text-primary mt-4 inline-block">← Back to marketplace</Link>
        </main>
      </div>
    );
  }

  const addToCart = (goToCheckout = false) => {
    if (!listing) return toast.error("This product is not available for purchase");
    if (requiresFlavor && !selectedFlavor) {
      return toast.error("Please select a flavor");
    }
    
    // Include flavor in the cart item name
    const itemName = selectedFlavor 
      ? `${product.name} (${selectedFlavor})` 
      : product.name;
    
    add({
      listing_id: product.id,
      name: itemName,
      price: product.price,
      image: product.image,
      ships_from: product.ships_from,
      flavor: selectedFlavor || undefined,
    });
    
    if (goToCheckout) {
      nav("/checkout");
    } else {
      toast.success("Added to cart");
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 pt-28 pb-20">
        <Link to="/shop" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </Link>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="glass-card rounded-3xl overflow-hidden aspect-square relative group">
            <img
              src={product.image}
              alt={product.name}
              width={800}
              height={800}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">{product.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span>{product.stock} in stock</span>
                {product.ships_from && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> Ships from {product.ships_from}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Price</div>
                <div className="font-display text-5xl font-bold text-gradient">${product.price}</div>
              </div>

              {/* Flavor selection - only shown if flavors exist */}
              {requiresFlavor && (
                <div className="space-y-2">
                  <Label>Select Flavor <span className="text-destructive">*</span></Label>
                  <Select value={selectedFlavor} onValueChange={setSelectedFlavor}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a flavor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {flavors.map((flavor) => (
                        <SelectItem key={flavor} value={flavor}>
                          {flavor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedFlavor && (
                    <p className="text-xs text-muted-foreground">You must select a flavor to continue</p>
                  )}
                </div>
              )}

              <Button
                onClick={() => addToCart(true)}
                size="lg"
                className="w-full h-12 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-cyan font-semibold"
                disabled={product.stock <= 0 || (requiresFlavor && !selectedFlavor)}
              >
                {product.stock <= 0 ? "Out of stock" : "Buy now"}
              </Button>
              <Button
                onClick={() => addToCart(false)}
                size="lg"
                variant="outline"
                className="w-full h-12 border-primary/40 hover:bg-primary/10 hover:border-primary hover:text-primary"
                disabled={product.stock <= 0 || (requiresFlavor && !selectedFlavor)}
              >
                <ShoppingBag className="h-4 w-4 mr-2" /> Add to cart
              </Button>
            </div>

            <p className="text-muted-foreground leading-relaxed">{product.description}</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductDetail;