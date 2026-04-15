export const BLOOMS = [
  { index: 1, name: "Rosewake" },
  { index: 2, name: "Sunlily" },
  { index: 3, name: "Honeyvine" },
  { index: 4, name: "Crownflower" },
  { index: 5, name: "Goldleaf" },
  { index: 6, name: "Midsong" },
  { index: 7, name: "Emberpetal" },
  { index: 8, name: "Glasslotus" },
  { index: 9, name: "Silkpoppy" },
  { index: 10, name: "Dreamfruit" },
  { index: 11, name: "Moonblush" },
  { index: 12, name: "Frostthistle" },
] as const;

export const PETAL_CYCLE = [
  { index: 1, name: "Goldpetal" },
  { index: 2, name: "Rosepetal" },
  { index: 3, name: "Songpetal" },
  { index: 4, name: "Veilpetal" },
  { index: 5, name: "Vinepetal" },
  { index: 6, name: "Emberpetal" },
  { index: 7, name: "Moonpetal" },
] as const;

export const BELL_PERIODS = [
  { name: "Dawnglass", startBell: 0, endBell: 2 },
  { name: "Goldrise", startBell: 3, endBell: 5 },
  { name: "Courtlight", startBell: 6, endBell: 8 },
  { name: "High Sun", startBell: 9, endBell: 11 },
  { name: "Gilded Hush", startBell: 12, endBell: 14 },
  { name: "Late Glow", startBell: 15, endBell: 17 },
  { name: "Lanternrise", startBell: 18, endBell: 20 },
  { name: "Moondeep", startBell: 21, endBell: 23 },
] as const;

export type SummerCourtDateTime = {
  crown_year: number;
  bloom_index: number;
  petal: number;
  bell: number;
  chime: number;
};

export function getDayOfYear(bloomIndex: number, petal: number): number {
  return (bloomIndex - 1) * 28 + petal;
}

export function buildSortKey(dt: SummerCourtDateTime): string {
  const year = String(dt.crown_year).padStart(4, "0");
  const bloom = String(dt.bloom_index).padStart(2, "0");
  const petal = String(dt.petal).padStart(2, "0");
  const bell = String(dt.bell).padStart(2, "0");
  const chime = String(dt.chime).padStart(2, "0");
  return `${year}-${bloom}-${petal}-${bell}-${chime}`;
}

export function getPhaseIndexFromPetal(petal: number): 1 | 2 | 3 | 4 {
  if (petal >= 1 && petal <= 7) return 1;
  if (petal >= 8 && petal <= 14) return 2;
  if (petal >= 15 && petal <= 21) return 3;
  return 4;
}

export function getPetalCycleIndexFromPetal(petal: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return (((petal - 1) % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export function getPetalCycleNameFromPetal(petal: number): string {
  const cycleIndex = getPetalCycleIndexFromPetal(petal);
  return PETAL_CYCLE.find((d) => d.index === cycleIndex)?.name ?? "Unknown";
}

export function getBellPeriodName(bell: number): string {
  const match = BELL_PERIODS.find((period) => bell >= period.startBell && bell <= period.endBell);
  return match ? match.name : "Unknown";
}

export function getBloomName(bloomIndex: number): string {
  const bloom = BLOOMS.find((b) => b.index === bloomIndex);
  if (!bloom) throw new Error(`Invalid bloom_index: ${bloomIndex}`);
  return bloom.name;
}

export function getPetalCycleName(cycleIndex: number): string {
  const cycle = PETAL_CYCLE.find((d) => d.index === cycleIndex);
  if (!cycle) throw new Error(`Invalid petal_cycle_index: ${cycleIndex}`);
  return cycle.name;
}

export function formatTimeHHMM(bell: number, chime: number): string {
  return `${String(bell).padStart(2, "0")}:${String(chime).padStart(2, "0")}`;
}

export function formatPetalOrdinal(petal: number): string {
  const ordinals: Record<number, string> = {
    1: "First",
    2: "Second",
    3: "Third",
    4: "Fourth",
    5: "Fifth",
    6: "Sixth",
    7: "Seventh",
    8: "Eighth",
    9: "Ninth",
    10: "Tenth",
    11: "Eleventh",
    12: "Twelfth",
    13: "Thirteenth",
    14: "Fourteenth",
    15: "Fifteenth",
    16: "Sixteenth",
    17: "Seventeenth",
    18: "Eighteenth",
    19: "Nineteenth",
    20: "Twentieth",
    21: "Twenty-First",
    22: "Twenty-Second",
    23: "Twenty-Third",
    24: "Twenty-Fourth",
    25: "Twenty-Fifth",
    26: "Twenty-Sixth",
    27: "Twenty-Seventh",
    28: "Twenty-Eighth",
  };
  return ordinals[petal] ?? `${petal}`;
}

export function formatSummerCourtDateTimeFull(dt: SummerCourtDateTime): string {
  const bloomName = getBloomName(dt.bloom_index);
  const petalOrdinal = formatPetalOrdinal(dt.petal);
  const petalCycleName = getPetalCycleNameFromPetal(dt.petal);
  const time = formatTimeHHMM(dt.bell, dt.chime);
  return `Crown Year ${dt.crown_year}, ${bloomName} Bloom, ${petalOrdinal} Petal, ${petalCycleName}, ${time}`;
}

export function formatSummerCourtDateTimeStandard(dt: SummerCourtDateTime): string {
  const bloomName = getBloomName(dt.bloom_index);
  const petalOrdinal = formatPetalOrdinal(dt.petal);
  const time = formatTimeHHMM(dt.bell, dt.chime);
  return `${bloomName} Bloom, ${petalOrdinal} Petal, ${time}`;
}

export function formatSummerCourtCommentDateTime(dt: SummerCourtDateTime): string {
  const petalCycleName = getPetalCycleNameFromPetal(dt.petal);
  const time = formatTimeHHMM(dt.bell, dt.chime);
  return `${petalCycleName}, ${time}`;
}

export function validateSummerCourtDateTime(dt: SummerCourtDateTime): string[] {
  const issues: string[] = [];
  if (!Number.isInteger(dt.crown_year) || dt.crown_year < 1) issues.push("crown_year must be >= 1");
  if (!Number.isInteger(dt.bloom_index) || dt.bloom_index < 1 || dt.bloom_index > 12) {
    issues.push("bloom_index must be 1..12");
  }
  if (!Number.isInteger(dt.petal) || dt.petal < 1 || dt.petal > 28) issues.push("petal must be 1..28");
  if (!Number.isInteger(dt.bell) || dt.bell < 0 || dt.bell > 23) issues.push("bell must be 0..23");
  if (!Number.isInteger(dt.chime) || dt.chime < 0 || dt.chime > 59) issues.push("chime must be 0..59");
  return issues;
}

export function toSummerCourtDateTimeOrNull(value: Partial<SummerCourtDateTime> | null | undefined): SummerCourtDateTime | null {
  if (!value) return null;
  const crownYear = Number(value.crown_year);
  const bloomIndex = Number(value.bloom_index);
  const petal = Number(value.petal);
  const bell = Number(value.bell);
  const chime = Number(value.chime);
  if (![crownYear, bloomIndex, petal, bell, chime].every((v) => Number.isFinite(v))) {
    return null;
  }
  const candidate: SummerCourtDateTime = {
    crown_year: Math.trunc(crownYear),
    bloom_index: Math.trunc(bloomIndex),
    petal: Math.trunc(petal),
    bell: Math.trunc(bell),
    chime: Math.trunc(chime),
  };

  return validateSummerCourtDateTime(candidate).length === 0 ? candidate : null;
}

export function deriveSummerCourtFromIso(isoValue: string | null | undefined): SummerCourtDateTime | null {
  const date = new Date(String(isoValue || ""));
  if (Number.isNaN(date.getTime())) return null;

  return {
    crown_year: date.getUTCFullYear(),
    bloom_index: date.getUTCMonth() + 1,
    petal: Math.min(28, Math.max(1, date.getUTCDate())),
    bell: date.getUTCHours(),
    chime: date.getUTCMinutes(),
  };
}
