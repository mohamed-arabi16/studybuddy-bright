// Stripe price configuration
export const STRIPE_PRICES = {
  pro: {
    monthly: {
      price_id: "price_1SlworKOiO3L6ctFP0VkWQrt",
      product_id: "prod_TjPe4qqKRhdJUE",
      amount: 999, // $9.99
    },
    annual: {
      price_id: "price_1SlwowKOiO3L6ctFtMH63XqZ",
      product_id: "prod_TjPe0yXe15se1s",
      amount: 7999, // $79.99 (save ~33%)
    },
  },
} as const;

export type PlanTier = keyof typeof STRIPE_PRICES;
export type BillingCycle = "monthly" | "annual";

export function getPriceId(tier: PlanTier, cycle: BillingCycle): string {
  return STRIPE_PRICES[tier][cycle].price_id;
}

export function getPrice(tier: PlanTier, cycle: BillingCycle): number {
  return STRIPE_PRICES[tier][cycle].amount / 100;
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}