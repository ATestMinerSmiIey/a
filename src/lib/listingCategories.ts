export type ListingCategoryId =
  | "general"
  | "thc_edibles"
  | "thc_pens"
  | "codeine"
  | "codeine_syrup"
  | "promethazine";

export const LISTING_CATEGORIES: { id: ListingCategoryId; label: string; sectionTitle: string }[] = [
  { id: "general", label: "General", sectionTitle: "General" },
  { id: "thc_edibles", label: "THC edibles", sectionTitle: "THC edibles" },
  { id: "thc_pens", label: "THC pens", sectionTitle: "THC pens" },
  { id: "codeine", label: "Codeine", sectionTitle: "Codeine" },
  { id: "codeine_syrup", label: "Codeine syrup", sectionTitle: "Codeine syrup" },
  { id: "promethazine", label: "Promethazine", sectionTitle: "Promethazine" }
];

/** All valid category ids (for URL + DB validation). */
export const ALL_LISTING_CATEGORY_IDS: ListingCategoryId[] = LISTING_CATEGORIES.map((c) => c.id);

export const listingCategoryLabel = (id: string): string =>
  LISTING_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** Categories that require flavor selection */
export const FLAVOR_CATEGORIES: ListingCategoryId[] = ["thc_pens"];

export function isCategoryWithFlavors(categoryId: string): boolean {
  return FLAVOR_CATEGORIES.includes(categoryId as ListingCategoryId);
}
