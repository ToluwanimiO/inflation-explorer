
import type { Country } from "../lib/inflation";

export const countries: Country[] = [
  {
    code: "NGA",
    name: "Nigeria",
    currency: "NGN",
    symbol: "₦",
    rates: [
      { year: 2027, rate: 18.5, status: "projected" },
      { year: 2028, rate: 16.2, status: "projected" },
      { year: 2029, rate: 13.8, status: "projected" },
      { year: 2030, rate: 12.1, status: "projected" },
      { year: 2031, rate: 10.4, status: "projected" },
    ],
  },
  {
    code: "GHA",
    name: "Ghana",
    currency: "GHS",
    symbol: "GH₵",
    rates: [
      { year: 2027, rate: 10.2, status: "projected" },
      { year: 2028, rate: 8.7, status: "projected" },
      { year: 2029, rate: 7.4, status: "projected" },
      { year: 2030, rate: 6.5, status: "projected" },
      { year: 2031, rate: 5.8, status: "projected" },
    ],
  },
  {
    code: "USA",
    name: "United States",
    currency: "USD",
    symbol: "$",
    rates: [
      { year: 2027, rate: 2.6, status: "projected" },
      { year: 2028, rate: 2.4, status: "projected" },
      { year: 2029, rate: 2.3, status: "projected" },
      { year: 2030, rate: 2.2, status: "projected" },
      { year: 2031, rate: 2.2, status: "projected" },
    ],
  },
];
