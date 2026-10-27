
const IMF_API =
  "https://www.imf.org/external/datamapper/api/v2";

export const config = {
  path: "/api/imf-inflation",
};

export default async function handler(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const yearsParam = requestUrl.searchParams.get("years");

    if (!yearsParam) {
      return Response.json(
        { error: "Provide the requested years." },
        { status: 400 },
      );
    }

    const years = yearsParam
      .split(",")
      .map(Number);

    const validYears =
      years.length > 0 &&
      years.length <= 20 &&
      years.every(
        (year) =>
          Number.isInteger(year) &&
          year >= 1900 &&
          year <= 2100,
      );

    if (!validYears) {
      return Response.json(
        { error: "The requested years are invalid." },
        { status: 400 },
      );
    }

    const headers = {
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "InflationExplorer/1.0 (personal research app)",

    };

    const urls = [
      `${IMF_API}/countries`,
      `${IMF_API}/PCPIPCH?periods=${encodeURIComponent(years.join(","))}`,
      `${IMF_API}/indicators`,
    ];

    const responses = await Promise.all(
      urls.map((url) => fetch(url, { headers })),
    );

    // const failedResponse = responses.find(
    //   (response) => !response.ok,
    // );

    // if (failedResponse) {
    //   return Response.json(
    //     {
    //       error: `The IMF returned HTTP ${failedResponse.status}.`,
    //     },
    //     { status: 502 },
    //   );
    // }
    const failedIndex = responses.findIndex(
      (response) => !response.ok,
    );

    if (failedIndex !== -1) {
      const failedResponse = responses[failedIndex];
      const details = await failedResponse.text();

      console.error("IMF request failed:", {
        url: urls[failedIndex],
        status: failedResponse.status,
        details: details.slice(0, 500),
      });

      return Response.json(
        {
          error: `The IMF returned HTTP ${failedResponse.status}.`,
          failedUrl: urls[failedIndex],
          details: details.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const [
      countriesData,
      seriesData,
      metadataData,
    ] = await Promise.all(
      responses.map((response) => response.json()),
    );

    return Response.json({
      countriesData,
      seriesData,
      metadataData,
    });
  } catch (error) {
    console.error("IMF data request failed:", error);

    return Response.json(
      { error: "Unable to retrieve inflation data from the IMF." },
      { status: 502 },
    );
  }
}
