import { z } from "zod";

/**
 * Dawat Menu Schema — POC LOCK v0.1
 *
 * Design principles:
 * - Item identity is separate from price, offer, availability and order snapshots.
 * - Simple restaurants use only category -> item -> price.
 * - Variants/modifiers/schedules/offers are optional capabilities.
 * - Money is integer minor units (paise for INR); never floating-point currency.
 * - UNKNOWN is represented explicitly where absence of restaurant-provided data matters.
 * - This is the canonical menu-domain shape for ingestion/output. DB normalization may differ.
 */

const Id = z.string().min(1);
const IsoDateTime = z.string().datetime({ offset: true });
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm");
const Currency = z.string().length(3).default("INR");
const Money = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: Currency,
});

const Text = z.object({
  en: z.string().min(1),
});

const Media = z.object({
  id: Id,
  url: z.string().url(),
  kind: z.enum(["image", "video"]),
  source: z.enum(["restaurant", "dawat"]),
  altText: z.string().optional(),
});

const UnknownBoolean = z.enum(["yes", "no", "unknown"]);

const DietaryAttributes = z.object({
  vegetarian: UnknownBoolean.default("unknown"),
  vegan: UnknownBoolean.default("unknown"),
  eggless: UnknownBoolean.default("unknown"),
  containsAlcohol: UnknownBoolean.default("unknown"),
  spicyLevel: z.enum(["none", "mild", "medium", "hot", "very_hot", "unknown"]).default("unknown"),
});

const AllergenAttributes = z.object({
  peanuts: UnknownBoolean.default("unknown"),
  treeNuts: UnknownBoolean.default("unknown"),
  milk: UnknownBoolean.default("unknown"),
  egg: UnknownBoolean.default("unknown"),
  wheatGluten: UnknownBoolean.default("unknown"),
  soy: UnknownBoolean.default("unknown"),
  sesame: UnknownBoolean.default("unknown"),
  fish: UnknownBoolean.default("unknown"),
  shellfish: UnknownBoolean.default("unknown"),
});

const Tax = z.object({
  mode: z.enum(["inclusive", "exclusive", "not_applicable"]),
  ratePercent: z.number().min(0).max(100).optional(),
  code: z.string().optional(),
});

const Availability = z.object({
  status: z.enum(["available", "unavailable", "scheduled", "sold_out"]),
  scheduleIds: z.array(Id).default([]),
});

const WeeklyWindow = z.object({
  dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday
  start: Time,
  end: Time,
});

const Schedule = z.object({
  id: Id,
  name: Text,
  timezone: z.string().default("Asia/Kolkata"),
  windows: z.array(WeeklyWindow).min(1),
  activeFrom: IsoDateTime.optional(),
  activeUntil: IsoDateTime.optional(),
});

const Price = z.object({
  amount: Money,
  tax: Tax.optional(),
  validFrom: IsoDateTime.optional(),
  validUntil: IsoDateTime.optional(),
});

const Modifier = z.object({
  id: Id,
  name: Text,
  priceDelta: Money,
  available: z.boolean().default(true),
});

const ModifierGroup = z.object({
  id: Id,
  name: Text,
  required: z.boolean().default(false),
  minSelections: z.number().int().nonnegative().default(0),
  maxSelections: z.number().int().positive().optional(),
  modifiers: z.array(Modifier).min(1),
});

const Variant = z.object({
  id: Id,
  name: Text,
  price: Price,
  available: z.boolean().default(true),
  modifierGroupIds: z.array(Id).default([]),
});

const MenuItem = z.object({
  id: Id,
  name: Text,
  description: Text.optional(),
  media: z.array(Media).default([]),

  // Simple item: use basePrice and no variants.
  basePrice: Price.optional(),
  variants: z.array(Variant).default([]),
  modifierGroups: z.array(ModifierGroup).default([]),

  availability: Availability,
  schedules: z.array(Id).default([]),

  dietary: DietaryAttributes.default({}),
  allergens: AllergenAttributes.default({}),

  unit: z.enum(["piece", "plate", "portion", "serving", "kg", "g", "litre", "ml", "pack", "other"]).default("portion"),
  tags: z.array(z.string()).default([]),
});

const Category = z.object({
  id: Id,
  name: Text,
  description: Text.optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  itemIds: z.array(Id).default([]),
  scheduleIds: z.array(Id).default([]),
});

const Offer = z.object({
  id: Id,
  name: Text,
  description: Text.optional(),
  type: z.enum(["fixed_price", "percentage_discount", "fixed_discount", "buy_x_get_y"]),
  itemIds: z.array(Id).default([]),
  categoryIds: z.array(Id).default([]),
  fixedPrice: Money.optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: Money.optional(),
  startsAt: IsoDateTime,
  expiresAt: IsoDateTime,
  active: z.boolean().default(true),
  displayLabel: Text.optional(),
});

export const MenuSchema = z.object({
  schemaVersion: z.literal("0.1"),
  id: Id,
  restaurantGroupId: Id,
  branchId: Id,
  name: Text,
  currency: Currency,
  timezone: z.string().default("Asia/Kolkata"),

  categories: z.array(Category).default([]),
  items: z.array(MenuItem).default([]),
  schedules: z.array(Schedule).default([]),
  offers: z.array(Offer).default([]),

  status: z.enum(["draft", "published", "archived"]),
  version: z.number().int().positive(),
  publishedAt: IsoDateTime.optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export type Menu = z.infer<typeof MenuSchema>;
export type MenuItem = z.infer<typeof MenuItem>;
export type MenuOffer = z.infer<typeof Offer>;
export type MenuSchedule = z.infer<typeof Schedule>;

/**
 * Ingestion-only metadata. This must NOT be treated as customer-visible truth.
 * The candidate becomes canonical only after restaurant verification.
 */
export const MenuIngestionMetadataSchema = z.object({
  sourceType: z.enum(["pdf", "image", "spreadsheet", "csv", "url", "text", "manual"]),
  extractor: z.string(),
  extractorVersion: z.string().optional(),
  overallConfidence: z.number().min(0).max(1),
  verificationStatus: z.enum(["pending", "verified", "rejected"]),
  fieldConfidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  ambiguities: z.array(z.object({
    path: z.string(),
    reason: z.string(),
  })).default([]),
});

export type MenuIngestionMetadata = z.infer<typeof MenuIngestionMetadataSchema>;
