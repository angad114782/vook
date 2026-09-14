import type { PlanData } from '../api/subscriptions';

// Palette indexed by price rank (cheapest = 0). Grows as needed.
const PALETTE: { bg: string; color: string; border: string }[] = [
  { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' }, // gray  – cheapest
  { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' }, // blue
  { bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' }, // purple
  { bg: '#fef9c3', color: '#854d0e', border: '#fde68a' }, // amber
  { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }, // green
  { bg: '#ffedd5', color: '#9a3412', border: '#fed7aa' }, // orange
  { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' }, // pink
  { bg: '#e0f2fe', color: '#075985', border: '#bae6fd' }, // sky
];

export interface PlanBadge {
  bg: string;
  color: string;
  border: string;
  label: string;
}

// Returns badge style + label for a plan type string.
// allPlans must be the live list from subscriptionsApi.getPlans().
export function getPlanBadge(planType: string, allPlans: PlanData[]): PlanBadge {
  const upper = planType.toUpperCase();
  const sorted = [...allPlans].sort((a, b) => a.price - b.price);
  const idx = sorted.findIndex((p) => p.type.toUpperCase() === upper);
  const palette = PALETTE[idx >= 0 ? idx % PALETTE.length : 0]!;
  const plan = allPlans.find((p) => p.type.toUpperCase() === upper);
  return { ...palette, label: plan?.name ?? planType };
}
