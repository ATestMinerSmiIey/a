import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Listing = {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  display_image_url: string;
  stock: number;
  ships_from: string;
  flavors: string;
  created_at: string;
  updated_at: string;
};

export type NewListing = {
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  stock: number;
  ships_from: string;
  flavors: string;
};

const getDisplayImage = async (imagePath: string) => {
  if (!imagePath || imagePath.startsWith("http") || imagePath.startsWith("/")) return imagePath;
  const { data } = await supabase.storage.from("listing-images").createSignedUrl(imagePath, 60 * 60);
  return data?.signedUrl ?? "";
};

/** Use session (local JWT) — same identity PostgREST uses. `getUser()` can be empty while the session is still valid. */
async function requireUserFromSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.user) throw new Error("Not signed in");
  return session.user;
}

export const useListings = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, seller_id, name, description, category, price, image_url, stock, ships_from, flavors, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    if (error) {
      setListings([]);
      setLoading(false);
      throw error;
    }
    if (data) {
      const withImages = await Promise.all(
        (data as unknown as Listing[]).map(async (item) => ({
          ...item,
          category: item.category ?? "general",
          flavors: item.flavors ?? "",
          display_image_url: await getDisplayImage(item.image_url),
        })),
      );
      setListings(withImages);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh().catch(() => setLoading(false));
  }, [refresh]);

  const create = async (input: NewListing) => {
    const user = await requireUserFromSession();
    const { error } = await supabase.from("listings").insert({
      name: input.name,
      description: input.description,
      category: input.category,
      image_url: input.image_url,
      price: Number(input.price) || 0,
      stock: Number(input.stock) || 0,
      ships_from: input.ships_from,
      flavors: input.flavors,
      seller_id: user.id,
    });
    if (error) throw error;
    try {
      await refresh();
    } catch (e) {
      console.error("useListings refresh after create", e);
    }
  };

  const update = async (id: string, input: NewListing) => {
    const { error } = await supabase
      .from("listings")
      .update({
        name: input.name,
        description: input.description,
        category: input.category,
        image_url: input.image_url,
        price: Number(input.price) || 0,
        stock: Number(input.stock) || 0,
        ships_from: input.ships_from,
        flavors: input.flavors,
      })
      .eq("id", id);
    if (error) throw error;
    try {
      await refresh();
    } catch (e) {
      console.error("useListings refresh after update", e);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) throw error;
    try {
      await refresh();
    } catch (e) {
      console.error("useListings refresh after delete", e);
    }
  };

  const uploadImage = async (file: File) => {
    const user = await requireUserFromSession();

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("listing-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    return path;
  };

  return { listings, loading, create, update, remove, uploadImage, refresh };
};