
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  TrendingUp,
  Info,
  LoaderCircle,
  PencilLine,
} from "lucide-react";

import { countries } from "./data/countries";
import { fetchImfInflationRates } from "./lib/imf";
import {
  calculateFutureCost,
  calculatePurchasingPower,
  formatMoney,
  getSeverity,
  type AnnualRate,
  type Country,
  type ScenarioRates,
} from "./lib/inflation";

const BASE_YEAR = 2026;
const MIN_TARGET_YEAR = 2027;
const MAX_TARGET_YEAR = 2031;


import { CURRENCY_DETAILS } from "./data/currencies";

type DisplayCountry = Country & {
  currencyKnown: boolean;
};

function toDisplayCountry(country: {
  code: string;
  name: string;
  rates: AnnualRate[];
}): DisplayCountry {
  const currencyDetails = CURRENCY_DETAILS[country.code];

  return {
    ...country,
    currency: currencyDetails?.currency ?? "USD",
    symbol: currencyDetails?.symbol ?? "$",
    currencyKnown: Boolean(currencyDetails),
  };
}

function getRateStatusLabel(status: AnnualRate["status"]) {
  switch (status) {
    case "actual":
      return "Actual";
    case "estimate":
      return "Estimate";
    default:
      return "Projection";
  }
}

function getRateSourceLabel(
  rate: AnnualRate,
  isEdited: boolean,
) {
  if (isEdited) return "Edited by you";
  return getRateStatusLabel(rate.status);
}

function formatYear(year: number) {
  return String(year);
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: "purchasing" | "cost";
}) {
  const Icon = icon === "purchasing" ? TrendingUp : ArrowUpRight;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Icon size={18} />
        </span>
      </div>

      <p className="mt-4 break-words text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
        {value}
      </p>

      <p className="mt-2 text-sm leading-6 text-stone-500">
        {description}
      </p>
    </div>
  );
}

export default function App() {
  const [liveCountries, setLiveCountries] =
    useState<DisplayCountry[]>(() =>
      countries.map(toDisplayCountry),
    );

  const [selectedCode, setSelectedCode] = useState(
    countries[0]?.code ?? "NGA",
  );

  const [amountInput, setAmountInput] = useState("100000");
  const [targetYear, setTargetYear] = useState(MAX_TARGET_YEAR);
  const [editedRates, setEditedRates] = useState<ScenarioRates>({});
  const [showAnnualRates, setShowAnnualRates] = useState(false);

  const [dataSource, setDataSource] = useState(
    "Illustrative demo data",
  );
  const [lastModified, setLastModified] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const years = useMemo(
    () =>
      Array.from(
        { length: MAX_TARGET_YEAR - BASE_YEAR },
        (_, index) => BASE_YEAR + index + 1,
      ),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInflationData() {
      setDataLoading(true);
      setDataError(null);

      try {
        const result = await fetchImfInflationRates(years);

        if (cancelled) return;

        const mappedCountries = result.countries.map(toDisplayCountry);

        setLiveCountries(mappedCountries);
        setSelectedCode((currentCode) =>
          mappedCountries.some((country) => country.code === currentCode)
            ? currentCode
            : mappedCountries[0]?.code ?? "",
        );

        setDataSource(result.source);
        setLastModified(result.lastModified);
        setEditedRates({});
      } catch (error) {
        if (cancelled) return;

        setDataError(
          error instanceof Error
            ? error.message
            : "Could not load inflation data.",
        );

        // Keep the demo data available if the IMF request fails.
        setLiveCountries(countries.map(toDisplayCountry));
        setDataSource("Illustrative demo data");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    void loadInflationData();

    return () => {
      cancelled = true;
    };
  }, [years]);

  const selectedCountry = liveCountries.find(
    (country) => country.code === selectedCode,
  );

  const amount = Number(amountInput);
  const validAmount = Number.isFinite(amount) && amount > 0;

  const annualRates = useMemo(() => {
    if (!selectedCountry) return [];

    return selectedCountry.rates
      .filter((rate) => rate.year <= targetYear)
      .map((rate) => ({
        ...rate,
        activeRate: editedRates[rate.year] ?? rate.rate,
        isEdited: editedRates[rate.year] !== undefined,
      }));
  }, [selectedCountry, targetYear, editedRates]);

  const calculation = useMemo(() => {
    if (!selectedCountry || !validAmount) return null;

    try {
      const purchasingPower = calculatePurchasingPower(
        amount,
        selectedCountry.rates,
        targetYear,
        BASE_YEAR,
        editedRates,
      );

      const futureCost = calculateFutureCost(
        amount,
        selectedCountry.rates,
        targetYear,
        BASE_YEAR,
        editedRates,
      );

      return {
        purchasingPower,
        futureCost,
        loss: amount - purchasingPower,
        lossPercentage: ((amount - purchasingPower) / amount) * 100,
      };
    } catch {
      return null;
    }
  }, [selectedCountry, amount, validAmount, targetYear, editedRates]);

  const chartData = useMemo(() => {
    if (!selectedCountry || !validAmount) return [];

    const points = [{ year: BASE_YEAR, purchasingPower: amount }];

    for (let year = BASE_YEAR + 1; year <= targetYear; year += 1) {
      try {
        const purchasingPower = calculatePurchasingPower(
          amount,
          selectedCountry.rates,
          year,
          BASE_YEAR,
          editedRates,
        );

        points.push({ year, purchasingPower });
      } catch {
        // Skip years where the source data is incomplete or invalid.
      }
    }

    return points;
  }, [selectedCountry, amount, validAmount, targetYear, editedRates]);

  function handleRateChange(year: number, value: string) {
    if (value.trim() === "") {
      setEditedRates((current) => {
        const next = { ...current };
        delete next[year];
        return next;
      });
      return;
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue <= -100) return;

    setEditedRates((current) => ({
      ...current,
      [year]: parsedValue,
    }));
  }

  function resetRate(year: number) {
    setEditedRates((current) => {
      const next = { ...current };
      delete next[year];
      return next;
    });
  }

  function resetAllRates() {
    setEditedRates({});
  }

  function handleCountryChange(code: string) {
    setSelectedCode(code);
    setEditedRates({});
  }

  const hasEditedRates = Object.keys(editedRates).length > 0;
  const isDemoData = dataSource === "Illustrative demo data";

  return (
    <main className="min-h-screen bg-[#faf9f6] text-stone-900">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-stone-200 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Inflation Explorer
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                Understand what your money could be worth over time.
              </p>
            </div>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600">
            {dataLoading ? (
              <LoaderCircle className="animate-spin" size={14} />
            ) : (
              <span
                className={`h-2 w-2 rounded-full ${
                  isDemoData ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
            )}
            {dataLoading
              ? "Loading inflation data"
              : isDemoData
                ? "Demo data"
                : "IMF Data loaded"}
          </div>
        </header>

        <section className="py-8 sm:py-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
              Your money, over time
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              What will your money be worth in the future?
            </h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-stone-600">
              Choose a country, enter an amount, and explore how inflation
              could affect its purchasing power.
            </p>
          </div>
        </section>

        {dataError && (
          <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <Info className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold">
                Could not retrieve the latest data.
              </p>
              <p>{dataError}</p>
              <p className="mt-1">
                You can still explore the illustrative demo rates below.
              </p>
            </div>
          </div>
        )}

        {isDemoData && !dataLoading && (
          <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <Info className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold">Illustrative data, not IMF forecasts</p>
              <p>
                The current figures are examples to demonstrate the calculator.
                Do not use them as verified country inflation projections.
              </p>
            </div>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <label
              htmlFor="country"
              className="mb-2 block text-sm font-medium text-stone-600"
            >
              Country or economy
            </label>
            <div className="relative">
              <select
                id="country"
                value={selectedCode}
                onChange={(event) => handleCountryChange(event.target.value)}
                className="w-full appearance-none rounded-xl border border-stone-200 bg-white px-3 py-3 pr-10 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                {liveCountries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500"
                size={17}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Select the economy whose inflation rates you want to explore.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <label
              htmlFor="amount"
              className="mb-2 block text-sm font-medium text-stone-600"
            >
              Amount in {BASE_YEAR}
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-100">
              <span className="text-sm font-medium text-stone-500">
                {selectedCountry?.symbol ?? ""}
              </span>
              <input
                id="amount"
                type="number"
                min="0.01"
                step="any"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                className="w-full min-w-0 bg-transparent py-3 text-sm outline-none"
                placeholder="100000"
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              The amount whose purchasing power you want to understand.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <label
              htmlFor="target-year"
              className="mb-2 block text-sm font-medium text-stone-600"
            >
              Calculate purchasing power in
            </label>
            <div className="relative">
              <select
                id="target-year"
                value={targetYear}
                onChange={(event) => setTargetYear(Number(event.target.value))}
                className="w-full appearance-none rounded-xl border border-stone-200 bg-white px-3 py-3 pr-10 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                {Array.from(
                  { length: MAX_TARGET_YEAR - MIN_TARGET_YEAR + 1 },
                  (_, index) => MIN_TARGET_YEAR + index,
                ).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500"
                size={17}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAnnualRates((visible) => !visible)}
              className="mt-3 flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-emerald-800 transition hover:text-emerald-950"
              aria-expanded={showAnnualRates}
            >
              <span className="flex items-center gap-2">
                <PencilLine size={15} />
                {showAnnualRates ? "Hide annual rates" : "Edit annual rates"}
              </span>
              {showAnnualRates ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
          </div>
        </section>

        {showAnnualRates && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-stone-100 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold">Annual inflation rates</h3>
                <p className="mt-1 max-w-xl text-sm leading-6 text-stone-500">
                  These rates are used in the calculation. Edit a year to
                  explore a different outcome. All unedited years keep their
                  original values.
                </p>
              </div>
              {hasEditedRates && (
                <button
                  type="button"
                  onClick={resetAllRates}
                  className="flex w-fit shrink-0 items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
                >
                  <RotateCcw size={14} />
                  Reset all
                </button>
              )}
            </div>

            <div className="divide-y divide-stone-100">
              {annualRates.map((rate) => {
                const severity = getSeverity(rate.activeRate);

                return (
                  <div
                    key={rate.year}
                    className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[0.7fr_1fr_1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-medium">{rate.year}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {getRateSourceLabel(rate, rate.isEdited)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative w-full max-w-36">
                        <input
                          aria-label={`Inflation rate for ${rate.year}`}
                          type="number"
                          step="0.1"
                          min="-99.9"
                          value={rate.activeRate}
                          onChange={(event) =>
                            handleRateChange(rate.year, event.target.value)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 pr-8 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${severity.className}`}
                      >
                        {severity.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      {rate.isEdited ? (
                        <span className="text-xs text-emerald-800">
                          Modified
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">
                          Original rate
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => resetRate(rate.year)}
                        disabled={!rate.isEdited}
                        aria-label={`Reset ${rate.year} rate`}
                        title={`Reset ${rate.year} rate`}
                        className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <RotateCcw size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-stone-100 bg-stone-50 px-5 py-3 text-xs leading-5 text-stone-500">
              Rates must be greater than -100%. An empty field restores that
              year's original rate. Changes update your results automatically.
            </div>
          </section>
        )}

        {selectedCountry && !selectedCountry.currencyKnown && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <p className="font-semibold">Currency needs verification</p>
            <p>
              A verified currency mapping is not available for this economy.
              Monetary values are temporarily displayed in USD and may not
              represent the selected economy's currency.
            </p>
          </div>
        )}

        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">
                Your results
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                Based on the currently selected annual inflation rates.
              </p>
            </div>
            {hasEditedRates && (
              <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
                Includes your edits
              </span>
            )}
          </div>

          {calculation ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <StatCard
                  label={`Purchasing power in ${targetYear}`}
                  value={formatMoney(
                    calculation.purchasingPower,
                    selectedCountry?.currency ?? "USD",
                  )}
                  description={`Your ${formatMoney(amount, selectedCountry?.currency ?? "USD")} in ${BASE_YEAR} may buy as much as this amount buys in ${BASE_YEAR}, based on the selected rates.`}
                  icon="purchasing"
                />

                <StatCard
                  label={`Future cost in ${targetYear}`}
                  value={formatMoney(
                    calculation.futureCost,
                    selectedCountry?.currency ?? "USD",
                  )}
                  description={`The estimated amount needed in ${targetYear} to match what ${formatMoney(amount, selectedCountry?.currency ?? "USD")} buys in ${BASE_YEAR}.`}
                  icon="cost"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold">
                      Purchasing power over time
                    </h3>
                    <p className="mt-1 text-sm text-stone-500">
                      How the value of your {formatMoney(
                        amount,
                        selectedCountry?.currency ?? "USD",
                      )} changes with inflation.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-700" />
                    Purchasing power
                  </div>
                </div>

                <div className="mt-6 h-64 w-full sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="purchasingPowerFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#047857"
                            stopOpacity={0.18}
                          />
                          <stop
                            offset="95%"
                            stopColor="#047857"
                            stopOpacity={0.01}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke="#e7e5e4"
                        strokeDasharray="4 4"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="year"
                        tickFormatter={formatYear}
                        tick={{ fill: "#78716c", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={12}
                      />

                      <YAxis
                        width={76}
                        tickFormatter={(value: number) =>
                          new Intl.NumberFormat("en", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(value)
                        }
                        tick={{ fill: "#78716c", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip
                        formatter={(value) => [
                          formatMoney(
                            Number(value),
                            selectedCountry?.currency ?? "USD",
                          ),
                          "Purchasing power",
                        ]}
                        labelFormatter={(label) => `Year ${label}`}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e7e5e4",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
                          fontSize: 12,
                        }}
                      />

                      <Area
                        type="monotone"
                        dataKey="purchasingPower"
                        stroke="#047857"
                        strokeWidth={2.5}
                        fill="url(#purchasingPowerFill)"
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        dot={{ r: 3, fill: "#047857", strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-sm leading-6 text-stone-600">
                  <Info className="mt-0.5 shrink-0 text-stone-400" size={17} />
                  <p>
                    Purchasing power is expressed in {BASE_YEAR} money.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <p className="font-medium">Unable to calculate a result yet.</p>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                Enter a positive amount and make sure the selected country has
                valid inflation data for every year through {targetYear}.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
              <Info size={19} />
            </div>
            <div>
              <h3 className="font-semibold">About these estimates</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Inflation reduces how much money can buy over time. This
                calculator compounds each year's selected inflation rate to
                estimate future costs and purchasing power. Actual inflation
                can differ from estimates and projections, so results are
                illustrative rather than guaranteed predictions.
              </p>

              <div className="mt-4 space-y-1 text-xs leading-5 text-stone-500">
                <p>
                  <span className="font-medium text-stone-600">Data source:</span>{" "}
                  {dataSource}
                </p>
                {lastModified && (
                  <p>
                    <span className="font-medium text-stone-600">
                      Source last modified:
                    </span>{" "}
                    {lastModified}
                  </p>
                )}
                <p>
                  <span className="font-medium text-stone-600">
                    Calculation period:
                  </span>{" "}
                  {BASE_YEAR}–{targetYear}
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-8 flex flex-col gap-2 border-t border-stone-200 pt-5 text-xs leading-5 text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Inflation Explorer · A tool for exploring purchasing power</p>
          <button
            type="button"
            onClick={() => {
              setAmountInput("100000");
              setTargetYear(MAX_TARGET_YEAR);
              setEditedRates({});
              setShowAnnualRates(false);
            }}
            className="flex w-fit items-center gap-2 font-medium text-stone-600 transition hover:text-emerald-800"
          >
            <RotateCcw size={13} />
            Reset calculator
          </button>
        </footer>
      </div>
    </main>
  );
}
