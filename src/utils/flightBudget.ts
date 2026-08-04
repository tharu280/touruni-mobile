import type { FlightOption } from '../types';

const LKR_PER_CURRENCY: Record<string, number> = {
  AED: 82,
  LKR: 1,
  USD: 300,
};

export type FlightBudgetHandoff = {
  estimatedFlightLkr: number | null;
  remainingBudgetLkr: number | null;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const estimateFlightBudgetHandoff = (
  flight: FlightOption | null,
  totalBudgetLkr: number | null | undefined,
): FlightBudgetHandoff => {
  const total = toFiniteNumber(totalBudgetLkr);

  if (!flight) {
    return {
      estimatedFlightLkr: null,
      remainingBudgetLkr: total,
    };
  }

  const price = toFiniteNumber(flight.price);
  const rate = toFiniteNumber(LKR_PER_CURRENCY[String(flight.currency || '').toUpperCase()]);
  if (price === null || rate === null) {
    return {
      estimatedFlightLkr: null,
      remainingBudgetLkr: total,
    };
  }

  const estimatedFlightLkr = price * rate;
  return {
    estimatedFlightLkr,
    remainingBudgetLkr:
      total === null ? null : Math.max(0, total - estimatedFlightLkr),
  };
};
