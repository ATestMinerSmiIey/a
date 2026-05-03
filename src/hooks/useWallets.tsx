import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Coin = "xmr" | "btc" | "eth" | "ltc" | "sol";
export type Wallets = Record<Coin, string>;

export const COINS: { id: Coin; label: string; name: string; color: string }[] = [
  { id: "xmr", label: "XMR", name: "Monero",   color: "text-orange-400" },
  { id: "btc", label: "BTC", name: "Bitcoin",  color: "text-yellow-400" },
  { id: "eth", label: "ETH", name: "Ethereum", color: "text-blue-400"   },
  { id: "ltc", label: "LTC", name: "Litecoin", color: "text-sky-400"    },
  { id: "sol", label: "SOL", name: "Solana",   color: "text-purple-400" },
];

const DEFAULT: Wallets = { xmr: "", btc: "", eth: "", ltc: "", sol: "" };

export const useWallets = () => {
  const [wallets, setWallets] = useState<Wallets>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("wallet_settings")
      .select("coin, address");
    if (!error && data) {
      const map = { ...DEFAULT };
      for (const row of data as { coin: string; address: string }[]) {
        if (row.coin in map) map[row.coin as Coin] = row.address ?? "";
      }
      setWallets(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (coin: Coin, address: string) => {
    const { error } = await supabase
      .from("wallet_settings")
      .upsert({ coin, address }, { onConflict: "coin" });
    if (error) throw error;
    setWallets((w) => ({ ...w, [coin]: address }));
  };

  return { wallets, loading, save, reload: load };
};
