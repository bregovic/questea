import {
  Sun, Moon, CloudSun, CloudMoon, Cloudy, CloudFog,
  CloudDrizzle, CloudRain, CloudSnow, CloudLightning, CloudHail,
} from "lucide-react";
import type { Weather } from "@/lib/weather";

/* WMO kód (+ den/noc) → piktogram. Držíme se sady lucide, ať to ladí se zbytkem blogu. */
function iconFor(code: number, isDay: boolean) {
  if (code === 0) return isDay ? Sun : Moon;
  if (code === 1 || code === 2) return isDay ? CloudSun : CloudMoon;
  if (code === 3) return Cloudy;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code === 96 || code === 99) return CloudHail;
  if (code === 95) return CloudLightning;
  return Cloudy;
}

/**
 * Decentní údaj o počasí do hlavičky blogu: název místa, teplota, piktogram.
 * `caption` odlišuje základnu od aktuální polohy.
 */
export function WeatherBadge({
  weather, place, caption,
}: { weather: Weather; place: string; caption: string }) {
  const Icon = iconFor(weather.code, weather.isDay);
  return (
    <div
      className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/10 backdrop-blur-md bg-white/5 shadow-2xl"
      title={`${weather.label}, vítr ${weather.wind} km/h`}
    >
      <Icon size={26} className="text-white/80 shrink-0" strokeWidth={1.5} />
      <div className="text-left leading-tight">
        <div className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em]">{caption}</div>
        <div className="text-white font-black text-sm uppercase tracking-wider">{place}</div>
      </div>
      <div className="text-white font-black text-2xl tabular-nums pl-1">{weather.temperature}°</div>
    </div>
  );
}
