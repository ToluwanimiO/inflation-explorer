export type RateStatus = "actual" | "estimate" | "projected";

export type AnnualRate = {
  year: number;
  rate: number;
  status: RateStatus;
};

export type Country = {
  code: string;
  name: string;
  currency: string;
  symbol: string;
  rates: AnnualRate[];
};

export type ScenarioRates = Record<number, number>;

export function calculateMultiplier(
  rates: AnnualRate[],
  targetYear: number,
  baseYear = 2026,
  overrides: ScenarioRates = {},
): number {
  let multiplier = 1;

  for (let year = baseYear + 1; year <= targetYear; year++) {
    const annualRate = rates.find((item) => item.year === year);

    if (!annualRate) {
      throw new Error(`No inflation rate available for ${year}.`);
    }

    const rate = overrides[year] ?? annualRate.rate;

    if (!Number.isFinite(rate) || rate <= -100) {
      throw new Error(`Invalid inflation rate for ${year}.`);
    }

    multiplier *= 1 + rate / 100;
  }

  return multiplier;
}

export function calculatePurchasingPower(
  amount: number,
  rates: AnnualRate[],
  targetYear: number,
  baseYear = 2026,
  overrides: ScenarioRates = {},
): number {
  return amount / calculateMultiplier(
    rates,
    targetYear,
    baseYear,
    overrides,
  );
}

export function calculateFutureCost(
  amount: number,
  rates: AnnualRate[],
  targetYear: number,
  baseYear = 2026,
  overrides: ScenarioRates = {},
): number {
  return amount * calculateMultiplier(
    rates,
    targetYear,
    baseYear,
    overrides,
  );
}

export function formatMoney(
  amount: number,
  currency: string,
  locale = "en-NG",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getSeverity(rate: number): {
  label: string;
  className: string;
} {
  if (rate < 0) {
    return {
      label: "Deflation",
      className: "bg-sky-50 text-sky-700",
    };
  }

  if (rate < 3) {
    return {
      label: "Low",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (rate < 6) {
    return {
      label: "Moderate",
      className: "bg-amber-50 text-amber-700",
    };
  }

  if (rate < 15) {
    return {
      label: "High",
      className: "bg-orange-50 text-orange-700",
    };
  }

  return {
    label: "Very high",
    className: "bg-rose-50 text-rose-700",
  };
}

export function formatRate(rate: number): string {
  return `${rate > 0 ? "+" : ""}${rate.toFixed(1)}%`;
}