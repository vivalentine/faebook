const BLOOMS = [
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
];

const PETAL_CYCLE = [
  { index: 1, name: "Goldpetal" },
  { index: 2, name: "Rosepetal" },
  { index: 3, name: "Songpetal" },
  { index: 4, name: "Veilpetal" },
  { index: 5, name: "Vinepetal" },
  { index: 6, name: "Emberpetal" },
  { index: 7, name: "Moonpetal" },
];

const BELL_PERIODS = [
  { name: "Dawnglass", startBell: 0, endBell: 2 },
  { name: "Goldrise", startBell: 3, endBell: 5 },
  { name: "Courtlight", startBell: 6, endBell: 8 },
  { name: "High Sun", startBell: 9, endBell: 11 },
  { name: "Gilded Hush", startBell: 12, endBell: 14 },
  { name: "Late Glow", startBell: 15, endBell: 17 },
  { name: "Lanternrise", startBell: 18, endBell: 20 },
  { name: "Moondeep", startBell: 21, endBell: 23 },
];

function getDayOfYear(bloomIndex, petal) {
  return (bloomIndex - 1) * 28 + petal;
}

function buildSortKey(dt) {
  const year = String(dt.crown_year).padStart(4, "0");
  const bloom = String(dt.bloom_index).padStart(2, "0");
  const petal = String(dt.petal).padStart(2, "0");
  const bell = String(dt.bell).padStart(2, "0");
  const chime = String(dt.chime).padStart(2, "0");
  return `${year}-${bloom}-${petal}-${bell}-${chime}`;
}

function getPhaseIndexFromPetal(petal) {
  if (petal >= 1 && petal <= 7) return 1;
  if (petal >= 8 && petal <= 14) return 2;
  if (petal >= 15 && petal <= 21) return 3;
  return 4;
}

function getPetalCycleIndexFromPetal(petal) {
  return ((petal - 1) % 7) + 1;
}

function getPetalCycleNameFromPetal(petal) {
  const cycleIndex = getPetalCycleIndexFromPetal(petal);
  return PETAL_CYCLE.find((cycle) => cycle.index === cycleIndex)?.name || "Unknown";
}

function getBellPeriodName(bell) {
  const period = BELL_PERIODS.find((entry) => bell >= entry.startBell && bell <= entry.endBell);
  return period ? period.name : "Unknown";
}

function validateSummerCourtDateTime(dt) {
  const issues = [];
  if (!Number.isInteger(dt.crown_year) || dt.crown_year < 1) issues.push("crown_year must be >= 1");
  if (!Number.isInteger(dt.bloom_index) || dt.bloom_index < 1 || dt.bloom_index > 12) {
    issues.push("bloom_index must be 1..12");
  }
  if (!Number.isInteger(dt.petal) || dt.petal < 1 || dt.petal > 28) issues.push("petal must be 1..28");
  if (!Number.isInteger(dt.bell) || dt.bell < 0 || dt.bell > 23) issues.push("bell must be 0..23");
  if (!Number.isInteger(dt.chime) || dt.chime < 0 || dt.chime > 59) issues.push("chime must be 0..59");
  return issues;
}

const SUMMER_COURT_TIMESTAMP_FIELDS = ["crown_year", "bloom_index", "petal", "bell", "chime"];

function hasCompleteSummerCourtTimestamp(value = {}) {
  return SUMMER_COURT_TIMESTAMP_FIELDS.every(
    (field) => value[field] !== null && value[field] !== undefined && value[field] !== "" && Number.isInteger(Number(value[field]))
  );
}

function compareSummerCourtTimestamps(left, right) {
  if (!hasCompleteSummerCourtTimestamp(left) || !hasCompleteSummerCourtTimestamp(right)) {
    return null;
  }

  for (const field of SUMMER_COURT_TIMESTAMP_FIELDS) {
    const difference = Number(left[field]) - Number(right[field]);
    if (difference !== 0) return difference;
  }
  return 0;
}

function isSummerCourtTimestampVisible(timestamp, campaignState) {
  const comparison = compareSummerCourtTimestamps(timestamp, campaignState);
  return comparison === null || comparison <= 0;
}

function buildSummerCourtVisibilitySql(tableAlias, campaignState) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(tableAlias || ""))) {
    throw new Error("Invalid Summer Court SQL table alias");
  }
  if (!hasCompleteSummerCourtTimestamp(campaignState)) {
    throw new Error("Campaign state must contain a complete Summer Court timestamp");
  }

  const columns = SUMMER_COURT_TIMESTAMP_FIELDS.map((field) => `${tableAlias}.${field}`);
  const campaignTuple = SUMMER_COURT_TIMESTAMP_FIELDS.map((field) => Number(campaignState[field])).join(", ");
  return `((${columns.join(" IS NULL OR ")} IS NULL) OR (${columns.join(", ")}) <= (${campaignTuple}))`;
}

module.exports = {
  BLOOMS,
  PETAL_CYCLE,
  BELL_PERIODS,
  getDayOfYear,
  buildSortKey,
  getPhaseIndexFromPetal,
  getPetalCycleIndexFromPetal,
  getPetalCycleNameFromPetal,
  getBellPeriodName,
  validateSummerCourtDateTime,
  SUMMER_COURT_TIMESTAMP_FIELDS,
  hasCompleteSummerCourtTimestamp,
  compareSummerCourtTimestamps,
  isSummerCourtTimestampVisible,
  buildSummerCourtVisibilitySql,
};
