import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, TrendingUp, Package, DollarSign, Wallet, Save, Pencil, Upload, CheckCircle, Clock, Truck, XCircle, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useWallets, COINS, type Coin } from "@/hooks/useWallets";
import { useListings, type Listing } from "@/hooks/useListings";
import { LISTING_CATEGORIES } from "@/lib/listingCategories";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const emptyForm = { name: "", description: "", category: "general", price: "", image_url: "", stock: "", ships_from: "", flavors: "" };

// Categories that require flavor selection
const FLAVOR_CATEGORIES = ["thc-pens", "thc_pens", "thc-pen", "thc_pen"];

/** PostgREST often uses PGRST301 and "Row level security…" (spaces), not "row-level". */
function flattenDbError(err: unknown): { code: string; lower: string; rawMessage: string } {
  if (err instanceof PostgrestError) {
    const parts = [err.message, err.details, err.hint].filter(Boolean);
    return { code: err.code, lower: parts.join(" ").toLowerCase(), rawMessage: err.message };
  }
  if (err instanceof Error) {
    return { code: "", lower: err.message.toLowerCase(), rawMessage: err.message };
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const o = err as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const parts = [o.message, o.details, o.hint].filter((x) => x != null && String(x).length > 0).map(String);
    return { code: String(o.code ?? ""), lower: parts.join(" ").toLowerCase(), rawMessage: String(o.message ?? "") };
  }
  return { code: "", lower: "", rawMessage: "" };
}

function messageForListingSaveError(err: unknown): string {
  const { code, lower, rawMessage } = flattenDbError(err);
  if (err instanceof Error && err.message === "Not signed in") {
    return "Your session is missing. Sign out and sign in again, then retry.";
  }
  const rls =
    code === "PGRST301" ||
    code === "42501" ||
    lower.includes("row-level security") ||
    lower.includes("row level security") ||
    lower.includes("rls") && lower.includes("violat");
  if (rls) {
    return "You don't have permission to save listings. This account must be an admin.";
  }
  if (lower.includes("permission denied") && lower.includes("function")) {
    return "Database policies are out of date. Re-run the latest Supabase migrations for this project.";
  }
  if (
    code === "PGRST204" ||
    (lower.includes("schema cache") && lower.includes("category")) ||
    (lower.includes("could not find") && lower.includes("category") && lower.includes("listings"))
  ) {
    return "Your database is missing the listings 'category' column. In Supabase, open SQL Editor and run the migrations from this project (files under supabase/migrations), starting with the ones that alter public.listings.";
  }
  if (code === "23514" || lower.includes("listings_category_valid")) {
    return "That category isn't allowed by the database yet. Pick another or apply migrations.";
  }
  if (lower.includes("violates check constraint")) {
    return "Something doesn't pass database rules (text length, price, or stock). Adjust the fields and retry.";
  }
  if (lower.includes("column") && lower.includes("does not exist")) {
    return "The database is out of date. Apply the latest Supabase migrations.";
  }
  if (lower.includes("jwt") || (lower.includes("expired") && lower.includes("token"))) {
    return "Your session expired. Sign in again.";
  }
  if (import.meta.env.DEV && import.meta.env.VITE_VERBOSE_API_ERRORS === "true" && (rawMessage || code)) {
    return `Save failed: ${code ? `${code} — ` : ""}${rawMessage || lower || String(err)}`.slice(0, 280);
  }
  return "Failed to save listing. Please try again.";
}

type OrderItem = {
  listing_name: string;
  quantity: number;
  unit_price_usd: number;
  ships_from?: string;
};

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
  tracking_carrier: number | null;
  tracking_synced_at: string | null;
  order_items: OrderItem[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: typeof Clock }> = {
  pending:   { label: "Pending",          color: "text-yellow-400", dot: "bg-yellow-400",  icon: Clock        },
  paid:      { label: "Paid",             color: "text-primary",    dot: "bg-primary",     icon: CheckCircle  },
  shipped:   { label: "Shipped",          color: "text-sky-400",    dot: "bg-sky-400",     icon: Truck        },
  delivered: { label: "Delivered",        color: "text-green-400",  dot: "bg-green-400",   icon: CheckCircle  },
  cancelled: { label: "Cancelled",        color: "text-destructive",dot: "bg-destructive", icon: XCircle      },
};

const NEXT_STATUSES: Record<string, { value: string; label: string }[]> = {
  pending:   [{ value: "paid",      label: "Confirm payment" }, { value: "cancelled", label: "Cancel order" }],
  paid:      [{ value: "shipped",   label: "Mark as shipped" }, { value: "cancelled", label: "Cancel order" }],
  shipped:   [{ value: "delivered", label: "Mark delivered"  }],
  delivered: [],
  cancelled: [],
};

const Dashboard = () => {
  const { wallets, loading, save } = useWallets();
  const { listings, create, update, remove, uploadImage } = useListings();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingCoin, setSavingCoin] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!loading) setDrafts({ xmr: wallets.xmr, btc: wallets.btc, eth: wallets.eth, ltc: wallets.ltc, sol: wallets.sol });
  }, [loading, wallets]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, amount_usd, ship_to_address, ship_to_country, buyer_contact, notes, status, payment_coin, created_at, tracking_number, tracking_carrier, tracking_synced_at")
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch order items separately
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id, listing_name, quantity, unit_price_usd, ships_from");

      if (itemsError) throw itemsError;

      // Map items to orders
      const itemsByOrderId = new Map<string, OrderItem[]>();
      itemsData?.forEach((item: any) => {
        if (!itemsByOrderId.has(item.order_id)) {
          itemsByOrderId.set(item.order_id, []);
        }
        itemsByOrderId.get(item.order_id)!.push({
          listing_name: item.listing_name,
          quantity: item.quantity,
          unit_price_usd: item.unit_price_usd,
          ships_from: item.ships_from,
        });
      });

      // Combine orders with their items
      const combinedOrders: Order[] = (ordersData || []).map((order: any) => ({
        ...order,
        order_items: itemsByOrderId.get(order.id) || [],
      }));

      setOrders(combinedOrders);
    } catch (err) {
      console.error("Failed to load orders:", err);
      toast.error("Failed to load orders");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingOrder(orderId);
    try {
      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
      if (error) throw error;
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      toast.success(`Order marked as ${STATUS_CONFIG[status]?.label ?? status}`);

      if (status === "paid") {
        const { data, error: fnErr } = await supabase.functions.invoke("order-assign-tracking", {
          body: { order_id: orderId },
        });
        if (fnErr) {
          console.error(fnErr);
          toast.error("Package tracker lookup failed. Set TRACK17_TOKEN on the edge function and ensure shipments are registered in 17TRACK.");
        } else if (data && typeof data === "object") {
          const d = data as { tracking_number?: string; tracking_carrier?: number | null; skipped?: boolean; reason?: string };
          if (d.tracking_number) {
            toast.success(`Tracking linked: ${d.tracking_number}`);
            const now = new Date().toISOString();
            setOrders((prev) =>
              prev.map((o) =>
                o.id === orderId
                  ? { ...o, tracking_number: d.tracking_number!, tracking_carrier: d.tracking_carrier ?? null, tracking_synced_at: now }
                  : o,
              ),
            );
          } else if (d.skipped && d.reason) {
            toast.message(d.reason);
          }
        }
        void loadOrders();
      }
    } catch {
      toast.error("Failed to update order status.");
    } finally {
      setUpdatingOrder(null);
    }
  };

  const stats = [
    { label: "Revenue (total)",  value: `$${orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + Number(o.amount_usd), 0).toFixed(2)}`, icon: DollarSign, color: "text-primary" },
    { label: "Active listings",  value: listings.length, icon: Package,   color: "text-secondary" },
    { label: "Confirmed orders", value: orders.filter(o => ["paid","shipped","delivered"].includes(o.status)).length, icon: TrendingUp, color: "text-primary" },
  ];

  const resetListingForm = () => { setForm(emptyForm); setEditingId(null); };

  const openEditor = (listing?: Listing) => {
    if (listing) {
      setEditingId(listing.id);
      setForm({ 
        name: listing.name, 
        description: listing.description, 
        category: listing.category ?? "general", 
        price: String(Number(listing.price)), 
        image_url: listing.image_url, 
        stock: String(listing.stock), 
        ships_from: listing.ships_from ?? "",
        flavors: listing.flavors ?? ""
      });
    } else {
      resetListingForm();
    }
    setOpen(true);
  };

  const handleSave = async (coin: Coin) => {
    setSavingCoin(coin);
    try {
      await save(coin, (drafts[coin] ?? "").trim());
      toast.success(`${coin.toUpperCase()} wallet saved`);
    } catch {
      toast.error("Failed to save wallet. Please try again.");
    } finally {
      setSavingCoin(null);
    }
  };

  const handleImageUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file"); return; }
    setUploading(true);
    try {
      const path = await uploadImage(file);
      setForm((f) => ({ ...f, image_url: path }));
      toast.success("Image uploaded");
    } catch {
      toast.error("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (form.name.trim().length > 120) return toast.error("Name must be 120 characters or fewer");
    if (form.description.trim().length > 2000) return toast.error("Description must be 2000 characters or fewer");
    if (Number(form.price) < 0) return toast.error("Price cannot be negative");
    if (Number(form.stock) < 0) return toast.error("Stock cannot be negative");
    if (!LISTING_CATEGORIES.some((c) => c.id === form.category)) return toast.error("Choose a valid category");
    setCreating(true);
    try {
      const payload = { 
        name: form.name.trim(), 
        description: form.description.trim(), 
        category: form.category, 
        price: Number(form.price) || 0, 
        image_url: form.image_url.trim(), 
        stock: Number(form.stock) || 0, 
        ships_from: form.ships_from.trim(),
        flavors: FLAVOR_CATEGORIES.includes(form.category) ? form.flavors.trim() : ""
      };
      if (editingId) { await update(editingId, payload); toast.success("Listing updated"); }
      else { await create(payload); toast.success("Listing published"); }
      resetListingForm();
      setOpen(false);
    } catch (e) {
      console.error("listing save", e);
      toast.error(messageForListingSaveError(e));
    } finally {
      setCreating(false);
    }
  };

  // Filter orders based on status and search query
  let filteredOrders = statusFilter === "all" ? orders : orders.filter(o => o.status === statusFilter);
  if (searchQuery.trim()) {
    filteredOrders = filteredOrders.filter(o => 
      o.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 pt-28 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-primary font-medium">Admin console</span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mt-2">Dashboard</h1>
          </div>
          <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetListingForm(); }}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-gradient-primary text-primary-foreground hover:opacity-90" onClick={() => openEditor()}>
                <Plus className="h-4 w-4 mr-2" /> New listing
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? "Edit listing" : "New listing"}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      {LISTING_CATEGORIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Price (USD)</Label><Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Stock</Label><Input type="number" min="0" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label>Ships from</Label><Input value={form.ships_from} onChange={(e) => setForm((f) => ({ ...f, ships_from: e.target.value }))} placeholder="e.g. Berlin, Germany" /></div>
                {FLAVOR_CATEGORIES.includes(form.category) && (
                  <div className="space-y-2">
                    <Label>Flavors</Label>
                    <Textarea 
                      value={form.flavors} 
                      onChange={(e) => setForm((f) => ({ ...f, flavors: e.target.value }))} 
                      placeholder="Enter each flavor on a new line, e.g.&#10;Strawberry&#10;Blue Raspberry&#10;Mango&#10;Grape"
                      rows={5}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">One flavor per line. Customers must select a flavor before checkout.</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Listing image</Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input type="file" accept="image/*" onChange={(e) => void handleImageUpload(e.target.files?.[0])} disabled={uploading} />
                    <Button type="button" variant="outline" disabled={uploading} className="shrink-0"><Upload className="h-4 w-4 mr-2" /> {uploading ? "Uploading…" : "Upload"}</Button>
                  </div>
                  <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="Image path or URL" className="font-mono text-xs" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={creating || uploading}>{creating ? "Saving…" : editingId ? "Save changes" : "Publish"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {stats.map((s, i) => (
            <div key={s.label} className="glass-card rounded-2xl p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className="font-display text-3xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Orders */}
        <div className="glass-card rounded-2xl overflow-hidden mb-10">
          <div className="p-6 border-b border-border/40 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-display text-xl font-semibold">Orders</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Confirm payments and manage fulfilment.</p>
                </div>
                {pendingCount > 0 && (
                  <span className="bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingCount} pending
                  </span>
                )}
              </div>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Order ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {["all", "pending", "paid", "shipped", "delivered", "cancelled"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${
                      statusFilter === s ? "bg-primary/15 text-primary border border-primary/40" : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {ordersLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading orders…</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {searchQuery ? "No orders found matching that Order ID." : "No orders yet."}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                const nextActions = NEXT_STATUSES[order.status] ?? [];
                const isExpanded = expandedOrder === order.id;
                const coinInfo = COINS.find(c => c.id === order.payment_coin);

                return (
                  <div key={order.id} className="hover:bg-primary/5 transition-colors">
                    {/* Order row */}
                    <div className="p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-primary">{order.id}</span>
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.color} border-current/30 bg-current/5`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          {coinInfo && (
                            <span className={`text-[11px] font-mono font-bold ${coinInfo.color}`}>{coinInfo.label}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(order.created_at).toLocaleString()} · {order.ship_to_country || "No country"}
                          {order.order_items?.length > 0 && ` · ${order.order_items.length} item${order.order_items.length > 1 ? "s" : ""}`}
                        </div>
                      </div>

                      <div className="font-display font-bold text-gradient shrink-0">${Number(order.amount_usd).toFixed(2)}</div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {nextActions.map((action) => (
                          <Button
                            key={action.value}
                            size="sm"
                            variant={action.value === "cancelled" ? "ghost" : "outline"}
                            className={
                              action.value === "paid"
                                ? "border-green-500/50 text-green-400 hover:bg-green-500/10 hover:border-green-500 text-xs h-8"
                                : action.value === "cancelled"
                                ? "hover:text-destructive text-xs h-8"
                                : "border-primary/40 hover:bg-primary/10 hover:text-primary text-xs h-8"
                            }
                            disabled={updatingOrder === order.id}
                            onClick={() => updateOrderStatus(order.id, action.value)}
                          >
                            {action.value === "paid" && <CheckCircle className="h-3 w-3 mr-1" />}
                            {action.value === "shipped" && <Truck className="h-3 w-3 mr-1" />}
                            {action.label}
                          </Button>
                        ))}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 grid sm:grid-cols-2 gap-4 text-sm border-t border-border/20 pt-4 mx-4">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Items ({order.order_items?.length || 0})</div>
                          {order.order_items && order.order_items.length > 0 ? (
                            order.order_items.map((item, i) => (
                              <div key={i} className="flex justify-between py-2 border-b border-border/20 last:border-0 gap-2">
                                <span className="text-muted-foreground flex-1">
                                  <div className="font-medium">{item.listing_name} × {item.quantity}</div>
                                  {item.ships_from && <div className="text-[10px] opacity-80">From {item.ships_from}</div>}
                                </span>
                                <span className="font-medium shrink-0">${(Number(item.unit_price_usd) * item.quantity).toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground">No items</div>
                          )}
                          {order.tracking_number && (
                            <div className="mt-3 pt-3 border-t border-border/30">
                              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Tracking</div>
                              <a
                                href={`https://www.17track.net/en/track?nums=${encodeURIComponent(order.tracking_number)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-mono text-xs break-all hover:underline"
                              >
                                {order.tracking_number}
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Ship to</div>
                            {order.ship_to_address ? (
                              <>
                                <div className="whitespace-pre-line text-xs bg-muted/50 p-2 rounded border border-border/30">{order.ship_to_address}</div>
                                <div className="text-xs font-medium mt-1">{order.ship_to_country || "No country specified"}</div>
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground italic">Pending (will be provided via Telegram)</div>
                            )}
                          </div>
                          {order.buyer_contact && (
                            <div>
                              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Contact</div>
                              <div className="font-mono text-xs break-all bg-muted/50 p-2 rounded border border-border/30">{order.buyer_contact}</div>
                            </div>
                          )}
                          {order.notes && (
                            <div>
                              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
                              <div className="text-xs whitespace-pre-line bg-muted/50 p-2 rounded border border-border/30">{order.notes}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Wallets */}
        <div className="glass-card rounded-2xl overflow-hidden mb-10">
          <div className="p-6 border-b border-border/40 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-display text-xl font-semibold">Crypto wallets</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Buyers send to these addresses at checkout.</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {COINS.map((coin) => (
              <div key={coin.id} className="space-y-1.5">
                <Label className={`text-xs uppercase tracking-wider font-medium ${coin.color}`}>
                  {coin.label} — {coin.name}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={drafts[coin.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [coin.id]: e.target.value }))}
                    placeholder={`Your ${coin.label} address`}
                    className="font-mono text-sm"
                    maxLength={200}
                  />
                  <Button
                    onClick={() => handleSave(coin.id)}
                    disabled={savingCoin === coin.id || drafts[coin.id] === wallets[coin.id]}
                    className="shrink-0"
                    variant="outline"
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {savingCoin === coin.id ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Listings */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-border/40">
            <h2 className="font-display text-xl font-semibold">Your listings</h2>
          </div>
          <div className="divide-y divide-border/40">
            {listings.length === 0 && <div className="p-8 text-sm text-muted-foreground text-center">No listings yet.</div>}
            {listings.map((p) => (
              <div key={p.id} className="p-4 flex items-center gap-4 hover:bg-primary/5 transition-colors">
                {p.display_image_url ? (
                  <img src={p.display_image_url} alt={p.name} width={64} height={64} className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-primary/30 text-primary/90 bg-primary/5">
                      {LISTING_CATEGORIES.find((c) => c.id === p.category)?.label ?? p.category}
                    </span>
                    <span>{p.stock} in stock</span>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="font-display font-bold text-gradient">${Number(p.price).toFixed(2)}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEditor(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="hover:text-destructive" onClick={() => remove(p.id).catch(() => toast.error("Failed to delete listing."))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;