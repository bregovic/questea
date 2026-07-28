/**
 * Aktuální počasí pro místo na blogu (Open-Meteo – zdarma, bez klíče).
 *
 * Volá se ze serveru při renderu blogu. Odpověď se drží ve fetch cache Next.js
 * na 15 minut, takže ani při náporu návštěv nejde na Open-Meteo víc než pár
 * dotazů za hodinu na jedno místo.
 */

export type Weather = {
  temperature: number; // °C
  code: number;        // WMO kód
  isDay: boolean;
  wind: number;        // km/h
  label: string;       // česky, do titulku
};

/* WMO kódy → česky. Skupiny podle https://open-meteo.com/en/docs */
const WMO: [number[], string][] = [
  [[0], "Jasno"],
  [[1], "Skoro jasno"],
  [[2], "Polojasno"],
  [[3], "Zataženo"],
  [[45, 48], "Mlha"],
  [[51, 53, 55], "Mrholení"],
  [[56, 57], "Mrznoucí mrholení"],
  [[61, 63, 65], "Déšť"],
  [[66, 67], "Mrznoucí déšť"],
  [[71, 73, 75, 77], "Sněžení"],
  [[80, 81, 82], "Přeháňky"],
  [[85, 86], "Sněhové přeháňky"],
  [[95], "Bouřka"],
  [[96, 99], "Bouřka s krupobitím"],
];

export function weatherLabel(code: number): string {
  for (const [codes, label] of WMO) if (codes.includes(code)) return label;
  return "Počasí";
}

export async function getWeather(lat: number, lng: number): Promise<Weather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=Europe%2FPrague`;

    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const json = await res.json();
    const c = json?.current;
    if (!c || typeof c.temperature_2m !== "number") return null;

    return {
      temperature: Math.round(c.temperature_2m),
      code: c.weather_code ?? 0,
      isDay: c.is_day === 1,
      wind: Math.round(c.wind_speed_10m ?? 0),
      label: weatherLabel(c.weather_code ?? 0),
    };
  } catch {
    return null; // počasí je ozdoba – když nevyjde, blog se tváří jako dřív
  }
}
