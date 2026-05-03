import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Minus, Plus, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";

const ADJECTIVES = ["RIPPED","SMOKED","BAKED","COOKED","GLAZED","DIPPED","FROSTED","PACKED"];
const genOrderId = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const suffix = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${adj}-${suffix}`;
};

const PAYMENT_METHODS = ["ETH","BTC","LTC","SOL","XMR","PayPal"];
const LINE = "──────────────────────────────────────";

const pad = (label: string, value: string, width = 38) => {
  const gap = width - label.length - value.length;
  return label + " ".repeat(Math.max(1, gap)) + value;
};

const buildReceipt = (
  items: { name: string; flavor?: string; price: number; quantity: number }[],
  orderId: string
): string => {
  const now = new Date();
  const dateStr = now.toLocaleString("en-GB", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(",", ",");

  const eta1 = new Date(now); eta1.setDate(now.getDate() + 5);
  const eta2 = new Date(now); eta2.setDate(now.getDate() + 7);
  const etaStr = `${eta1.toLocaleString("en-GB", { month: "short", day: "numeric" })}–${eta2.toLocaleString("en-GB", { month: "short", day: "numeric" })}  ·  5–7 days`;

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const shippingCost = subtotal >= 50 ? 0 : totalQty * 2.5;

  const lines: string[] = [
    "HiSupply — ORDER SUMMARY",
    LINE,
    `Order ID  :  ${orderId}`,
    `Date      :  ${dateStr}`,
    `Ships to  :  Worldwide`,
    `ETA       :  ${etaStr}`,
    "",
    "ITEMS",
    LINE,
  ];

  for (const item of items) {
    const itemTotal = `$${(item.price * item.quantity).toFixed(0)}`;
    lines.push(`${item.quantity}×  ${item.name}`);
    lines.push(pad(`    ${item.flavor ?? ""}`, itemTotal));
  }

  const grandTotal = subtotal + shippingCost;

  lines.push(LINE);
  lines.push(pad("Subtotal", `$${subtotal.toFixed(2)}`));
  lines.push(pad("Shipping", shippingCost === 0 ? "FREE" : `$${shippingCost.toFixed(2)}`));
  lines.push(LINE);
  lines.push(pad("TOTAL", `$${grandTotal.toFixed(2)}`));

  return lines.join("\n");
};

const Checkout = () => {
  const { items, total, setQuantity, remove } = useCart();
  const [receipt, setReceipt] = useState<string | null>(null);
  const [orderId] = useState(genOrderId);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const calculateTotal = () => {
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const shippingCost = subtotal >= 50 ? 0 : totalQty * 2.5;
    return subtotal + shippingCost;
  };

  const submitOrderToDatabase = async () => {
    setSubmitting(true);
    try {
      const grandTotal = calculateTotal();
      
      // 1. Insert order with the same orderId as the receipt
      const { error: orderError } = await supabase
        .from("orders")
        .insert({
          id: orderId,
          amount_usd: grandTotal,
          ship_to_address: "",
          ship_to_country: "",
          buyer_contact: "",
          notes: "",
          status: "pending",
          payment_coin: "",
        });

      if (orderError) {
        console.error("Order insert error:", orderError);
        throw orderError;
      }

      // 2. Insert order items - ensure correct format
      if (items.length > 0) {
        const orderItems = items.map((i) => ({
          order_id: orderId,
          listing_name: i.name || "Unknown Item",
          quantity: i.quantity || 1,
          unit_price_usd: Number(i.price) || 0,
          ships_from: i.ships_from || null,
        }));

        console.log("Inserting order items:", orderItems);

        const { data, error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems)
          .select();

        if (itemsError) {
          console.error("Order items insert error:", itemsError);
          // Don't throw - order was created successfully, just log the items error
          toast.warning("Order created but items failed to save. Please contact support.");
        } else {
          console.log("Items inserted successfully:", data);
        }
      }

      return true;
    } catch (err) {
      console.error("Failed to submit order:", err);
      toast.error("Failed to create order record. Please try again.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    if (items.length === 0) return toast.error("Your cart is empty");
    
    const text = buildReceipt(
      items.map((i) => ({ name: i.name, flavor: i.flavor, price: i.price, quantity: i.quantity })),
      orderId
    );
    
    setReceipt(text);
    navigator.clipboard.writeText(text).catch(() => {});
    
    // Submit order to database
    const success = await submitOrderToDatabase();
    if (success) {
      toast.success("Order created! Receipt copied to clipboard.");
    }
  };

  const handleCopy = () => {
    if (!receipt) return;
    navigator.clipboard.writeText(receipt).then(() => {
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 pt-28 pb-20 max-w-2xl">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Continue shopping
        </Link>

        <h1 className="font-display text-4xl font-bold mb-8">Checkout</h1>

        {items.length === 0 && !receipt ? (
          <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground">
            Your cart is empty.{" "}
            <Link to="/shop" className="text-primary">Browse the marketplace →</Link>
          </div>
        ) : receipt ? (
          /* ── RECEIPT VIEW ── */
          <div className="space-y-4">
            <div className="text-center py-6 space-y-2">
              <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-display text-xl font-semibold">Your order is on your clipboard</h2>
              <p className="text-sm text-muted-foreground">Paste it in our Telegram chat to proceed with payment.</p>
            </div>

            <a
              href="https://t.me/HiSupplyLife"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(90deg,#2AABEE,#229ED9)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
              </svg>
              Open t.me/HiSupplyLife
            </a>

            <div className="glass-card rounded-2xl overflow-hidden border border-border/40">
              <button
                onClick={() => setPreviewOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors"
              >
                <span>Show order preview</span>
                {previewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {previewOpen && (
                <>
                  <div className="px-5 pb-2 overflow-x-auto">
                    <pre className="text-xs leading-relaxed font-mono text-foreground/90 whitespace-pre select-all">
                      {receipt}
                    </pre>
                  </div>
                  <div className="border-t border-border/40">
                    <button
                      onClick={handleCopy}
                      className="w-full py-3.5 text-sm font-semibold tracking-wide text-foreground/80 hover:text-foreground hover:bg-muted/30 transition-colors uppercase"
                    >
                      {copied ? "Copied!" : "Copy again"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Payment methods — outside the receipt */}
            <div className="glass-card rounded-2xl p-5 text-center space-y-3">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Supported payment methods</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {PAYMENT_METHODS.map((m) => (
                  <span key={m} className="px-3 py-1.5 rounded-lg border border-border/50 text-xs font-medium text-foreground/80">{m}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── CART EDIT VIEW ── */
          <div className="space-y-5">
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-border/40">
                <h2 className="font-display text-lg font-semibold">Your cart</h2>
              </div>
              <div className="divide-y divide-border/40">
                {items.map((i) => (
                  <div key={`${i.listing_id}::${i.flavor ?? ""}`} className="p-4 flex items-center gap-3">
                    <img
                      src={i.image || "/placeholder.svg"}
                      alt={i.name}
                      className="w-14 h-14 rounded-xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{i.name}</div>
                      {i.flavor && <div className="text-xs text-muted-foreground truncate">{i.flavor}</div>}
                      <div className="text-xs text-muted-foreground mt-0.5">${i.price.toFixed(2)} each</div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setQuantity(i.listing_id, i.quantity - 1, i.flavor)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{i.quantity}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setQuantity(i.listing_id, i.quantity + 1, i.flavor)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="font-bold text-sm w-16 text-right shrink-0">
                      ${(i.price * i.quantity).toFixed(2)}
                    </div>

                    <Button size="icon" variant="ghost" className="hover:text-destructive shrink-0"
                      onClick={() => remove(i.listing_id, i.flavor)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 border-t border-border/40 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-display text-xl font-bold">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment methods on cart screen too */}
            <div className="glass-card rounded-2xl p-5 text-center space-y-3">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Supported payment methods</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {PAYMENT_METHODS.map((m) => (
                  <span key={m} className="px-3 py-1.5 rounded-lg border border-border/50 text-xs font-medium text-foreground/80">{m}</span>
                ))}
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              size="lg"
              disabled={submitting}
              className="w-full font-semibold text-base bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 shadow-md"
            >
              <Copy className="w-4 h-4 mr-2" />
              {submitting ? "Creating order…" : "Generate & copy order"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Generates a receipt and copies it — paste it in our Telegram to pay
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;