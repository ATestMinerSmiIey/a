import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallets, COINS, type Coin } from "@/hooks/useWallets";

type Order = {
  id: string;
  amount_usd: number;
  ship_to_address: string;
  ship_to_country: string;
  buyer_contact: string;
  notes: string;
  status: string;
  payment_coin: string;
  created_at: string;
  tracking_number: string | null;
};

type OrderItem = {
  id: string;
  listing_name: string;
  ships_from: string;
  unit_price_usd: number;
  quantity: number;
};

const STATUS_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  pending:   { label: "Awaiting payment", dot: "bg-yellow-400",    text: "text-yellow-400"    },
  paid:      { label: "Payment received", dot: "bg-primary",       text: "text-primary"       },
  shipped:   { label: "Shipped",          dot: "bg-primary",       text: "text-primary"       },
  delivered: { label: "Delivered",        dot: "bg-primary",       text: "text-primary"       },
  cancelled: { label: "Cancelled",        dot: "bg-destructive",   text: "text-destructive"   },
};

const OrderStatus = () => {
  const { id } = useParams();
  const { wallets } = useWallets();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setOrder(null); setLoading(false); return; }
      const [{ data: o }, { data: it }] = await Promise.all([
        supabase.from("orders").select("id,amount_usd,ship_to_address,ship_to_country,buyer_contact,notes,status,payment_coin,created_at,tracking_number").eq("id", id).maybeSingle(),
        supabase.from("order_items").select("id,listing_name,ships_from,unit_price_usd,quantity").eq("order_id", id),
      ]);
      setOrder(o as Order | null);
      setItems((it as OrderItem[]) ?? []);
      setLoading(false);
    })();
  }, [id]);

  const coinId = (order?.payment_coin ?? "xmr") as Coin;
  const coinInfo = COINS.find((c) => c.id === coinId) ?? COINS[0];
  const walletAddress = wallets[coinId] ?? "";

  const copy = () => {
    if (!walletAddress) return toast.error("Wallet not configured");
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;

  if (!order) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 pt-32 text-center">
          <h1 className="font-display text-3xl">Order not found</h1>
          <p className="text-muted-foreground text-sm mt-2">Sign in to view your orders.</p>
          <Link to="/signin" className="text-primary mt-4 inline-block">← Sign in</Link>
        </main>
      </div>
    );
  }

  const status = STATUS_STYLES[order.status] ?? STATUS_STYLES.pending;
  const showPayment = order.status === "pending";

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 pt-28 pb-20 max-w-4xl">
        <Link to="/shop" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-primary font-medium">Order</span>
            <h1 className="font-display text-3xl md:text-4xl font-bold mt-2 font-mono break-all">#{order.id.slice(0, 8)}</h1>
            <p className="text-xs text-muted-foreground mt-1">Placed {new Date(order.created_at).toLocaleString()}</p>
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-primary/30 ${status.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-glow-pulse`} />
            <span className="text-xs uppercase tracking-widest">{status.label}</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Items */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-border/40">
              <h2 className="font-display text-xl font-semibold">Items</h2>
            </div>
            <div className="divide-y divide-border/40">
              {items.map((i) => (
                <div key={i.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-semibold truncate">{i.listing_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Qty {i.quantity} · ${Number(i.unit_price_usd).toFixed(2)} {i.ships_from && `· from ${i.ships_from}`}
                    </div>
                  </div>
                  <div className="font-display font-bold">${(Number(i.unit_price_usd) * i.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border/40 flex justify-between items-end">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-bold text-gradient">${Number(order.amount_usd).toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Shipping */}
            <div className="glass-card rounded-2xl p-6 space-y-3 text-sm">
              <h2 className="font-display text-xl font-semibold">Shipping</h2>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Address</div>
                <div className="whitespace-pre-line">{order.ship_to_address}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Country</div>
                <div>{order.ship_to_country}</div>
              </div>
              {order.buyer_contact && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Contact</div>
                  <div className="font-mono break-all text-xs">{order.buyer_contact}</div>
                </div>
              )}
              {order.notes && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
                  <div className="whitespace-pre-line">{order.notes}</div>
                </div>
              )}
              {order.tracking_number && ["paid", "shipped", "delivered"].includes(order.status) && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Package tracking</div>
                  <a
                    href={`https://www.17track.net/en/track?nums=${encodeURIComponent(order.tracking_number)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-mono text-xs break-all hover:underline"
                  >
                    {order.tracking_number} → 17TRACK
                  </a>
                </div>
              )}
            </div>

            {/* Payment */}
            {showPayment && (
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display text-xl font-semibold">
                    Pay ${Number(order.amount_usd).toFixed(2)}
                  </h2>
                  <span className={`text-sm font-bold font-mono ${coinInfo.color}`}>{coinInfo.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Send the equivalent in {coinInfo.name}. Your order ships once payment is confirmed.
                </p>

                {walletAddress ? (
                  <div className="bg-white p-4 rounded-2xl mx-auto w-44 h-44 flex items-center justify-center mb-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(walletAddress)}`}
                      alt="QR code"
                      width={160}
                      height={160}
                    />
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground mb-4">
                    {coinInfo.name} wallet address not configured yet.
                  </div>
                )}

                <div className="glass rounded-xl p-3 flex items-center gap-2">
                  <code className="text-xs font-mono flex-1 truncate text-muted-foreground">{walletAddress || "—"}</code>
                  <Button size="icon" variant="ghost" onClick={copy} className="h-8 w-8 hover:text-primary">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrderStatus;