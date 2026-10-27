
import type { AnnualRate } from "./inflation";

type IMFCountry = {
  label: string;
};

type IMFProxyResponse = {
  error?: string;
  countriesData?: {
    countries?: Record<string, IMFCountry>;
  };
  seriesData?: {
    values?: {
      PCPIPCH?: Record<
        string,
        Record<string, number | null | string>
      >;
    };
  };
  metadataData?: {
    indicators?: {
      PCPIPCH?: {
        source?: string;
        label?: string;
        "last-modified"?: string;
      };
    };
  };
};

export type IMFInflationCountry = {
  code: string;
  name: string;
  rates: AnnualRate[];
};

export type IMFInflationData = {
  countries: IMFInflationCountry[];
  source: string;
  lastModified: string | null;
};

export async function fetchImfInflationRates(
  years: number[],
): Promise<IMFInflationData> {
  const response = await fetch("/data/imf-inflation.json");

  if (!response.ok) {
    throw new Error(
      `Could not load saved inflation data (${response.status}).`,
    );
  }

  const payload = (await response.json()) as IMFProxyResponse;

  const countryCatalogue = payload.countriesData?.countries;
  const countryValues = payload.seriesData?.values?.PCPIPCH;

  if (!countryCatalogue || !countryValues) {
    throw new Error("The saved IMF data has an unexpected structure.");
  }

  const result: IMFInflationCountry[] = [];

  for (const [code, metadata] of Object.entries(countryCatalogue)) {
    const yearlyValues = countryValues[code];

    if (!yearlyValues) continue;

    const rates: AnnualRate[] = [];

    for (const year of years) {
      const value = yearlyValues[String(year)];

      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value <= -100
      ) {
        continue;
      }

      rates.push({
        year,
        rate: value,
        status: "projected",
      });
    }

    // Keep only countries with data for every requested year.
    if (rates.length !== years.length) continue;

    result.push({
      code,
      name: metadata.label,
      rates,
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));

  if (result.length === 0) {
    throw new Error(
      "No countries have complete inflation data for all requested years.",
    );
  }

  const indicatorMetadata =
    payload.metadataData?.indicators?.PCPIPCH;

  return {
    countries: result,
    source:
      indicatorMetadata?.source ?? "IMF World Economic Outlook",
    lastModified: indicatorMetadata?.["last-modified"] ?? null,
  };
}

