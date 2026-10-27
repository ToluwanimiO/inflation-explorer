
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Info,
  RotateCcw,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";

import { countries } from "./data/countries";
import { fetchImfInflationRates } from "./lib/imf";
import {
  calculateFutureCost,
  calculatePurchasingPower,
  formatMoney,
  getSeverity,
} from "./lib/inflation";
import type { AnnualRate, Country, ScenarioRates } from "./lib/inflation";

const BASE_YEAR = 2026;
const MIN_TARGET_YEAR = 2027;
const MAX_TARGET_YEAR = 2031;

const CURRENCY_DETAILS: Record<
  string,
  { currency: string; symbol: string }
> = {
  NGA: { currency: "NGN", symbol: "₦" },
  GHA: { currency: "GHS", symbol: "GH₵" },
  USA: { currency: "USD", symbol: "$" },
  GBR: { currency: "GBP", symbol: "£" },
  EUR: { currency: "EUR", symbol: "€" },
  JPN: { currency: "JPY", symbol: "¥" },
  CHN: { currency: "CNY", symbol: "¥" },
  IND: { currency: "INR", symbol: "₹" },
  CAN: { currency: "CAD", symbol: "CA$" },
  AUS: { currency: "AUD", symbol: "A$" },
  CHE: { currency: "CHF", symbol: "CHF" },
  ZAF: { currency: "ZAR", symbol: "R" },
  KEN: { currency: "KES", symbol: "KSh" },
  EGY: { currency: "EGP", symbol: "E£" },
  BRA: { currency: "BRL", symbol: "R$" },
  MEX: { currency: "MXN", symbol: "MX$" },
  SGP: { currency: "SGD", symbol: "S$" },
  NZL: { currency: "NZD", symbol: "NZ$" },
  SAU: { currency: "SAR", symbol: "SAR" },
  ARE: { currency: "AED", symbol: "AED" },
};

function getCurrencyDetails(code: string) {
  return CURRENCY_DETAILS[code] ?? {
    currency: "USD",
    symbol: "$",
  };
}

export default function App() {
  const [liveCountries, setLiveCountries] =
    useState<Country[]>(countries);
  const [selectedCode, setSelectedCode] = useState("NGA");
  const [amountInput, setAmountInput] = useState("100000");
  const [targetYear, setTargetYear] = useState(2030);
  const [scenarioRates, setScenarioRates] = useState<ScenarioRates>({});
  const [showAnnualRates, setShowAnnualRates] = useState(false);
  const [dataSource, setDataSource] = useState("Illustrative demo data");
  const [lastModified, setLastModified] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInflationData() {
      try {
        const years = Array.from(
          { length: MAX_TARGET_YEAR - BASE_YEAR },
          (_, index) => BASE_YEAR + index + 1,
        );

        const result = await fetchImfInflationRates(years);

        if (cancelled) return;

        const mappedCountries: Country[] = result.countries.map(
          (item) => {
            const currencyDetails = getCurrencyDetails(item.code);

            return {
              code: item.code,
              name: item.name,
              currency: currencyDetails.currency,
              symbol: currencyDetails.symbol,
              rates: item.rates,
            };
          },
        );

        setLiveCountries(mappedCountries);

        setSelectedCode((current) =>
          mappedCountries.some((item) => item.code === current)
            ? current
            : mappedCountries[0]?.code ?? current,
        );

        setDataSource(result.source);
        setLastModified(result.lastModified);
        setDataError(null);
        setScenarioRates({});
      } catch (error) {
        if (cancelled) return;

        setDataError(
          error instanceof Error
            ? error.message
            : "Unable to load IMF data.",
        );
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadInflationData();

    return () => {
      cancelled = true;
    };
  }, []);

  const country =
    liveCountries.find((item) => item.code === selectedCode) ??
    liveCountries[0] ??
    countries[0];

  const amount = Math.max(0, Number(amountInput) || 0);

  const visibleRates = useMemo(
    () =>
      country.rates.filter(
        (item: AnnualRate) =>
          item.year > BASE_YEAR && item.year <= targetYear,
      ),
    [country, targetYear],
  );

  const chartData = useMemo(
    () =>
      visibleRates.map((item: AnnualRate) => ({
        year: String(item.year),
        baseline: item.rate,
        scenario: scenarioRates[item.year] ?? item.rate,
      })),
    [visibleRates, scenarioRates],
  );

  const baselinePurchasingPower = calculatePurchasingPower(
    amount,
    country.rates,
    targetYear,
    BASE_YEAR,
  );

  const scenarioPurchasingPower = calculatePurchasingPower(
    amount,
    country.rates,
    targetYear,
    BASE_YEAR,
    scenarioRates,
  );

  const baselineFutureCost = calculateFutureCost(
    amount,
    country.rates,
    targetYear,
    BASE_YEAR,
  );

  const scenarioFutureCost = calculateFutureCost(
    amount,
    country.rates,
    targetYear,
    BASE_YEAR,
    scenarioRates,
  );

  const purchasingPowerDifference =
    scenarioPurchasingPower - baselinePurchasingPower;

  const hasEdits = Object.keys(scenarioRates).some((year) => {
    const baseline = country.rates.find(
      (item) => item.year === Number(year),
    );

    return (
      baseline !== undefined &&
      scenarioRates[Number(year)] !== baseline.rate
    );
  });

  function updateRate(year: number, rawValue: string) {
    if (rawValue.trim() === "") {
      setScenarioRates((current) => {
        const updated = { ...current };
        delete updated[year];
        return updated;
      });
      return;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || value <= -100 || value > 1000) {
      return;
    }

    setScenarioRates((current) => ({
      ...current,
      [year]: value,
    }));
  }

  function resetYear(year: number) {
    setScenarioRates((current) => {
      const updated = { ...current };
      delete updated[year];
      return updated;
    });
  }

  function resetAllEdits() {
    setScenarioRates({});
  }

  function selectCountry(code: string) {
    setSelectedCode(code);
    setScenarioRates({});
  }

  function getRateForYear(item: AnnualRate) {
    return scenarioRates[item.year] ?? item.rate;
  }

  function isRateEdited(item: AnnualRate) {
    return (
      scenarioRates[item.year] !== undefined &&
      scenarioRates[item.year] !== item.rate
    );
  }

  return (
    <main className="min-h-screen bg-canvas text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3 no-underline">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-700 text-white">
              <TrendingUp size={23} />
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight text-forest-900">
                Inflation Explorer
              </p>
              <p className="text-xs text-slate-500">
                Understand your future purchasing power
              </p>
            </div>
          </a>

          <span className="hidden items-center rounded-full border border-forest-100 bg-white px-3 py-2 text-xs font-medium text-forest-700 sm:inline-flex">
            <span
              className={`mr-2 h-2 w-2 rounded-full ${
                dataLoading
                  ? "bg-amber-400"
                  : dataError
                    ? "bg-rose-500"
                    : "bg-emerald-500"
              }`}
            />
            {dataLoading
              ? "Loading IMF data"
              : dataError
                ? "Demo data · IMF unavailable"
                : "IMF data connected"}
          </span>
        </header>

        {/* Intro */}
        <section className="mb-8 max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-forest-600">
            Plan beyond today
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-forest-950 sm:text-5xl">
            What will your money
            <span className="text-forest-600"> be worth</span> tomorrow?
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Explore how inflation could affect your purchasing power over
            time. Adjust annual inflation assumptions and compare your
            scenario with the baseline projection.
          </p>
        </section>

        {/* Data source notice */}
        <div
          className={`mb-7 flex gap-3 rounded-2xl border p-4 text-sm leading-6 ${
            dataError
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-forest-100 bg-forest-50 text-forest-950"
          }`}
        >
          <Info className="mt-0.5 shrink-0" size={19} />

          <div>
            {dataLoading ? (
              <>
                <strong>Connecting to IMF data…</strong>
                <p>
                  Loading inflation assumptions for available economies.
                </p>
              </>
            ) : dataError ? (
              <>
                <strong>Using demo data.</strong>
                <p>
                  The IMF data request failed: {dataError} The dashboard
                  is retaining its illustrative rates rather than treating
                  missing data as zero.
                </p>
              </>
            ) : (
              <>
                <strong>Source: {dataSource}.</strong>
                <p>
                  Indicator: inflation rate, average consumer prices
                  (annual percent change). The current dataset contains
                  projected rates for 2027–2031. Scenario edits are
                  separate from the baseline.
                  {lastModified
                    ? ` Data metadata last modified: ${lastModified}.`
                    : ""}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Main controls */}
        <section className="grid gap-4 lg:grid-cols-[1fr_1fr_1.15fr]">
          {/* Country */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <label
              htmlFor="country"
              className="mb-3 block text-sm font-semibold text-slate-700"
            >
              Country / economy
            </label>

            <div className="relative">
              <select
                id="country"
                value={country.code}
                onChange={(event) => selectCountry(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-medium outline-none transition focus:border-forest-500 focus:ring-4 focus:ring-forest-50"
              >
                {liveCountries.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name} ({item.currency})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>

            <p className="mt-3 text-sm leading-5 text-slate-500">
              {liveCountries.length} economies with complete data for the
              selected projection period.
            </p>
          </div>

          {/* Amount */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <label
              htmlFor="amount"
              className="mb-3 block text-sm font-semibold text-slate-700"
            >
              Money you have today
            </label>

            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 focus-within:border-forest-500 focus-within:ring-4 focus-within:ring-forest-50">
              <span className="mr-3 text-sm font-semibold text-slate-400">
                {country.symbol}
              </span>
              <input
                id="amount"
                type="number"
                min="0"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                className="w-full min-w-0 bg-transparent py-3 text-lg font-semibold outline-none"
                placeholder="100000"
              />
            </div>

            <p className="mt-3 text-sm leading-5 text-slate-500">
              Your starting amount at the end of {BASE_YEAR}.
            </p>
          </div>

          {/* Target year */}
          <div className="rounded-3xl border border-forest-100 bg-forest-900 p-5 text-white shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="target-year"
                className="text-sm font-semibold text-forest-100"
              >
                Look into the future
              </label>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                {targetYear}
              </span>
            </div>

            <div className="mt-5">
              <input
                id="target-year"
                type="range"
                min={MIN_TARGET_YEAR}
                max={MAX_TARGET_YEAR}
                step="1"
                value={targetYear}
                onChange={(event) =>
                  setTargetYear(Number(event.target.value))
                }
                className="w-full cursor-pointer accent-emerald-300"
              />

              <div className="mt-2 flex justify-between text-xs text-forest-200">
                <span>{MIN_TARGET_YEAR}</span>
                <span>{MAX_TARGET_YEAR}</span>
              </div>
            </div>

            <button
              type="button"
              aria-expanded={showAnnualRates}
              aria-controls="annual-rates-panel"
              onClick={() =>
                setShowAnnualRates((current) => !current)
              }
              className="mt-5 flex w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-left transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <span>
                <span className="block text-sm font-semibold text-white">
                  {showAnnualRates ? "Hide annual rates" : "View annual rates"}
                </span>
                <span className="mt-1 block text-xs text-forest-100">
                  {visibleRates.length} year
                  {visibleRates.length === 1 ? "" : "s"} included
                </span>
              </span>

              {showAnnualRates ? (
                <ChevronUp size={19} className="shrink-0" />
              ) : (
                <ChevronDown size={19} className="shrink-0" />
              )}
            </button>
          </div>
        </section>

        {/* Expandable annual rates editor */}
        {showAnnualRates && (
          <section
            id="annual-rates-panel"
            className="mt-4 overflow-hidden rounded-3xl border border-forest-100 bg-white shadow-sm"
          >
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-forest-700" />
                  <h2 className="font-display text-lg font-bold text-forest-950">
                    Annual inflation assumptions
                  </h2>
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Edit any year to explore a different scenario. Unedited
                  years continue to use the baseline rate.
                </p>
              </div>

              {hasEdits && (
                <button
                  type="button"
                  onClick={resetAllEdits}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:self-center"
                >
                  <RotateCcw size={15} />
                  Reset all edits
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {visibleRates.map((item: AnnualRate) => {
                const currentRate = getRateForYear(item);
                const severity = getSeverity(currentRate);
                const edited = isRateEdited(item);

                return (
                  <div
                    key={item.year}
                    className="grid gap-4 px-5 py-5 sm:grid-cols-[0.7fr_1.2fr_1fr_auto] sm:items-center sm:px-6"
                  >
                    <div>
                      <p className="font-display text-lg font-bold text-forest-950">
                        {item.year}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {edited ? "Scenario rate" : "Baseline rate"}
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor={`rate-${item.year}`}
                        className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Annual inflation (%)
                      </label>
                      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-forest-500 focus-within:ring-4 focus-within:ring-forest-50">
                        <input
                          id={`rate-${item.year}`}
                          type="number"
                          step="0.1"
                          min="-99.9"
                          max="1000"
                          value={currentRate}
                          onChange={(event) =>
                            updateRate(item.year, event.target.value)
                          }
                          className="w-full min-w-0 bg-transparent py-2.5 text-sm font-semibold outline-none"
                        />
                        <span className="pl-2 text-sm text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${severity.className}`}
                      >
                        {severity.label}
                      </span>
                      {edited && (
                        <span className="rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-700">
                          Edited
                        </span>
                      )}
                      <span className="text-xs capitalize text-slate-400">
                        {item.status}
                      </span>
                    </div>

                    <div className="sm:justify-self-end">
                      <button
                        type="button"
                        onClick={() => resetYear(item.year)}
                        disabled={!edited}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-forest-800 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <RotateCcw size={14} />
                        Reset year
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
              <p className="text-xs leading-5 text-slate-500">
                These rates are compounded annually. Rates at or below
                -100% are not valid in this model. Severity labels are
                app-defined, not official classifications.
              </p>
            </div>
          </section>
        )}

        {/* Results heading */}
        <section className="mb-5 mt-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-forest-600">
              Your projection
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-forest-950 sm:text-3xl">
              Your money in {targetYear}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Compared with {BASE_YEAR}, using {country.name}&apos;s selected
              inflation assumptions.
            </p>
          </div>

          {hasEdits && (
            <button
              type="button"
              onClick={resetAllEdits}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw size={15} />
              Reset all edits
            </button>
          )}
        </section>

        {/* Results cards */}
        <section className="grid gap-4 md:grid-cols-3">
          <ResultCard
            title="Purchasing power"
            eyebrow="Baseline projection"
            value={formatMoney(
              baselinePurchasingPower,
              country.currency,
            )}
            description={`What ${formatMoney(amount, country.currency)} in ${BASE_YEAR} could buy in ${targetYear}, measured in ${BASE_YEAR} money.`}
            icon={<TrendingUp size={19} />}
          />

          <ResultCard
            title="Purchasing power"
            eyebrow="Your scenario"
            value={formatMoney(
              scenarioPurchasingPower,
              country.currency,
            )}
            description="The estimated value after applying your edited annual inflation assumptions."
            icon={<SlidersHorizontal size={19} />}
            featured
          />

          <ResultCard
            title="Scenario difference"
            eyebrow="Compared with baseline"
            value={`${purchasingPowerDifference > 0 ? "+" : purchasingPowerDifference < 0 ? "−" : ""}${formatMoney(
              Math.abs(purchasingPowerDifference),
              country.currency,
            )}`}
            description={
              purchasingPowerDifference > 0
                ? "Your scenario preserves more purchasing power than the baseline."
                : purchasingPowerDifference < 0
                  ? "Your scenario preserves less purchasing power than the baseline."
                  : "Your scenario currently matches the baseline projection."
            }
            icon={
              purchasingPowerDifference > 0 ? (
                <ArrowUpRight size={19} />
              ) : purchasingPowerDifference < 0 ? (
                <ArrowDownRight size={19} />
              ) : (
                <ArrowRight size={19} />
              )
            }
            positive={purchasingPowerDifference > 0}
          />
        </section>

        {/* Annual inflation chart */}
        <section className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-forest-950">
                Annual inflation comparison
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Compare the baseline rate with your scenario for each year.
              </p>
            </div>

            {hasEdits && (
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest-700">
                <span className="h-2 w-2 rounded-full bg-forest-600" />
                Scenario modified
              </span>
            )}
          </div>

          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="baselineFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#94a3b8"
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="95%"
                      stopColor="#94a3b8"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                  <linearGradient
                    id="scenarioFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#397653"
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="95%"
                      stopColor="#397653"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="#e9eeea"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="year"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickMargin={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                    fontSize: 12,
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="baseline"
                  name="Baseline"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  fill="url(#baselineFill)"
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="monotone"
                  dataKey="scenario"
                  name="Your scenario"
                  stroke="#397653"
                  strokeWidth={2.5}
                  fill="url(#scenarioFill)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <Info size={15} className="mt-0.5 shrink-0" />
            <p>
              The chart shows annual inflation rates, not the cumulative
              change in prices. Use the purchasing-power cards above to
              compare the compounded effect across the full period.
            </p>
          </div>
        </section>

        {/* Future cost comparison */}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-sm font-semibold text-slate-500">
              Future cost · baseline
            </p>
            <p className="mt-3 font-display text-2xl font-bold tracking-tight text-forest-950 sm:text-3xl">
              {formatMoney(baselineFutureCost, country.currency)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              An item costing {formatMoney(amount, country.currency)} in{" "}
              {BASE_YEAR} could cost this much in {targetYear} under the
              baseline rates.
            </p>
          </div>

          <div className="rounded-3xl border border-forest-100 bg-forest-50 p-5 shadow-sm sm:p-6">
            <p className="text-sm font-semibold text-forest-700">
              Future cost · your scenario
            </p>
            <p className="mt-3 font-display text-2xl font-bold tracking-tight text-forest-950 sm:text-3xl">
              {formatMoney(scenarioFutureCost, country.currency)}
            </p>
            <p className="mt-2 text-sm leading-6 text-forest-800">
              The same item under your scenario. Adjust the annual rates
              above to see how your assumptions change the projection.
            </p>
          </div>
        </section>

        {/* Methodology */}
        <section className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
              <Info size={19} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-forest-950">
                How this projection works
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Starting from the end of {BASE_YEAR}, the app compounds each
                annual inflation rate through {targetYear}. Purchasing
                power is calculated by dividing your starting amount by the
                cumulative price multiplier. Future cost uses the same
                multiplier in the opposite direction.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                These are scenarios, not guarantees. Actual inflation can
                differ from estimates and projections, and results depend
                on the selected data and assumptions.
              </p>
              {!dataError && !dataLoading && (
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Source: {dataSource}. Verify the source vintage and
                  projection status before using results for financial
                  decisions.
                </p>
              )}
            </div>
          </div>
        </section>

        <footer className="pb-4 pt-8 text-center text-xs leading-5 text-slate-400">
          Inflation Explorer · Built to explore assumptions, not predict
          the future with certainty.
        </footer>
      </div>
    </main>
  );
}

type ResultCardProps = {
  title: string;
  eyebrow: string;
  value: string;
  description: string;
  icon: ReactNode;
  featured?: boolean;
  positive?: boolean;
};

function ResultCard({
  title,
  eyebrow,
  value,
  description,
  icon,
  featured = false,
  positive = false,
}: ResultCardProps) {
  return (
    <article
      className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${
        featured
          ? "border-forest-700 bg-forest-900 text-white"
          : "border-slate-200/80 bg-white text-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-[0.12em] ${
              featured ? "text-forest-200" : "text-slate-500"
            }`}
          >
            {eyebrow}
          </p>
          <h3
            className={`mt-2 text-sm font-semibold ${
              featured ? "text-white" : "text-slate-700"
            }`}
          >
            {title}
          </h3>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            featured
              ? "bg-white/10 text-emerald-200"
              : positive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-forest-50 text-forest-700"
          }`}
        >
          {icon}
        </div>
      </div>

      <p
        className={`mt-5 break-words font-display text-2xl font-bold tracking-tight sm:text-3xl ${
          featured ? "text-white" : "text-forest-950"
        }`}
      >
        {value}
      </p>

      <p
        className={`mt-3 text-sm leading-6 ${
          featured ? "text-forest-100" : "text-slate-500"
        }`}
      >
        {description}
      </p>
    </article>
  );
}
