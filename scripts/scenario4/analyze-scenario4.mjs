import fs from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(
  "performance-results",
  "scenario4",
  "scenario4-summary.json",
);

const OUTPUT_JSON_PATH = path.join(
  "performance-results",
  "scenario4",
  "scenario4-statistics.json",
);

const OUTPUT_CSV_PATH = path.join(
  "performance-results",
  "scenario4",
  "scenario4-statistics.csv",
);
const INPUT_TEXT_LENGTH = 10;

const T_CRITICAL_95 = {
  1: 12.706,
  2: 4.303,
  3: 3.182,
  4: 2.776,
  5: 2.571,
  6: 2.447,
  7: 2.365,
  8: 2.306,
  9: 2.262,
  10: 2.228,
  11: 2.201,
  12: 2.179,
  13: 2.16,
  14: 2.145,
  15: 2.131,
  16: 2.12,
  17: 2.11,
  18: 2.101,
  19: 2.093,
  20: 2.086,
  21: 2.08,
  22: 2.074,
  23: 2.069,
  24: 2.064,
  25: 2.06,
  26: 2.056,
  27: 2.052,
  28: 2.048,
  29: 2.045,
  30: 2.042,
};

function round(value, digits = 2) {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Number(value.toFixed(digits));
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values) {
  if (values.length === 0) {
    return null;
  }

  return sum(values) / values.length;
}

function median(values) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
  }

  return sortedValues[middleIndex];
}

function variance(values) {
  if (values.length < 2) {
    return null;
  }

  const average = mean(values);
  const squaredDiffs = values.map((value) => (value - average) ** 2);

  return sum(squaredDiffs) / (values.length - 1);
}

function standardDeviation(values) {
  const value = variance(values);

  if (value === null) {
    return null;
  }

  return Math.sqrt(value);
}

function standardError(values) {
  const sd = standardDeviation(values);

  if (sd === null) {
    return null;
  }

  return sd / Math.sqrt(values.length);
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const position = (sortedValues.length - 1) * percentileValue;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const lowerValue = sortedValues[lowerIndex];
  const upperValue = sortedValues[upperIndex];
  const weight = position - lowerIndex;

  return lowerValue + (upperValue - lowerValue) * weight;
}

function confidenceInterval95(values) {
  if (values.length < 2) {
    return {
      low: null,
      high: null,
      halfWidth: null,
    };
  }

  const average = mean(values);
  const se = standardError(values);
  const degreesOfFreedom = values.length - 1;
  const tCritical = T_CRITICAL_95[degreesOfFreedom] ?? 1.96;
  const halfWidth = tCritical * se;

  return {
    low: average - halfWidth,
    high: average + halfWidth,
    halfWidth,
  };
}

function chunk(values, chunkSize) {
  const result = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    result.push(values.slice(index, index + chunkSize));
  }

  return result;
}

function describe(values) {
  const ci95 = confidenceInterval95(values);

  return {
    count: values.length,
    meanMs: round(mean(values)),
    medianMs: round(median(values)),
    standardDeviationMs: round(standardDeviation(values)),
    standardErrorMs: round(standardError(values)),
    minMs: round(Math.min(...values)),
    maxMs: round(Math.max(...values)),
    p75Ms: round(percentile(values, 0.75)),
    p90Ms: round(percentile(values, 0.9)),
    p95Ms: round(percentile(values, 0.95)),
    ci95LowMs: round(ci95.low),
    ci95HighMs: round(ci95.high),
    ci95HalfWidthMs: round(ci95.halfWidth),
  };
}

function calculateModeStatistics(summaryItem) {
  const allValues = summaryItem.inputToNextPaintValues;
  const runChunks = chunk(allValues, INPUT_TEXT_LENGTH);

  const perRunMeans = runChunks.map((runValues) => mean(runValues));
  const perRunMedians = runChunks.map((runValues) => median(runValues));

  return {
    scenario: summaryItem.scenario,
    mode: summaryItem.mode,
    runs: summaryItem.runs,
    rawMeasurements: describe(allValues),
    perRunMeans: describe(perRunMeans),
    perRunMedians: describe(perRunMedians),
    perRunMeanValues: perRunMeans.map((value) => round(value)),
    perRunMedianValues: perRunMedians.map((value) => round(value)),
  };
}

function calculateComparison(baselineStats, optimizedStats) {
  const baselineMean = baselineStats.perRunMeans.meanMs;
  const optimizedMean = optimizedStats.perRunMeans.meanMs;

  const baselineMedian = baselineStats.perRunMedians.meanMs;
  const optimizedMedian = optimizedStats.perRunMedians.meanMs;

  const meanDiffValues = baselineStats.perRunMeanValues.map(
    (baselineValue, index) => baselineValue - optimizedStats.perRunMeanValues[index],
  );

  const medianDiffValues = baselineStats.perRunMedianValues.map(
    (baselineValue, index) =>
      baselineValue - optimizedStats.perRunMedianValues[index],
  );

  return {
    meanBasedDifference: {
      absoluteReductionMs: round(baselineMean - optimizedMean),
      relativeReductionPercent: round(
        ((baselineMean - optimizedMean) / baselineMean) * 100,
      ),
      speedupRatio: round(baselineMean / optimizedMean),
      pairedDifferenceStats: describe(meanDiffValues),
    },
    medianBasedDifference: {
      absoluteReductionMs: round(baselineMedian - optimizedMedian),
      relativeReductionPercent: round(
        ((baselineMedian - optimizedMedian) / baselineMedian) * 100,
      ),
      speedupRatio: round(baselineMedian / optimizedMedian),
      pairedDifferenceStats: describe(medianDiffValues),
    },
  };
}

function toCsvRows(statistics) {
  const rows = [
    [
      "scenario",
      "mode",
      "level",
      "count",
      "meanMs",
      "medianMs",
      "standardDeviationMs",
      "standardErrorMs",
      "minMs",
      "maxMs",
      "p75Ms",
      "p90Ms",
      "p95Ms",
      "ci95LowMs",
      "ci95HighMs",
      "ci95HalfWidthMs",
    ],
  ];

  for (const item of statistics.modes) {
    for (const [level, stats] of Object.entries({
      rawMeasurements: item.rawMeasurements,
      perRunMeans: item.perRunMeans,
      perRunMedians: item.perRunMedians,
    })) {
      rows.push([
        item.scenario,
        item.mode,
        level,
        stats.count,
        stats.meanMs,
        stats.medianMs,
        stats.standardDeviationMs,
        stats.standardErrorMs,
        stats.minMs,
        stats.maxMs,
        stats.p75Ms,
        stats.p90Ms,
        stats.p95Ms,
        stats.ci95LowMs,
        stats.ci95HighMs,
        stats.ci95HalfWidthMs,
      ]);
    }
  }

  return rows.map((row) => row.join(",")).join("\n");
}

async function main() {
  const fileContent = await fs.readFile(INPUT_PATH, "utf-8");
  const summary = JSON.parse(fileContent);

  const modeStatistics = summary.map(calculateModeStatistics);

  const baselineStats = modeStatistics.find((item) => item.mode === "baseline");
  const optimizedStats = modeStatistics.find((item) => item.mode === "optimized");

  if (!baselineStats || !optimizedStats) {
    throw new Error("Both baseline and optimized results are required.");
  }

  const statistics = {
    scenario: "scenario4",
    interpretationUnit:
      "One run is treated as one independent observation. Raw measurements are descriptive only.",
    modes: modeStatistics,
    comparison: calculateComparison(baselineStats, optimizedStats),
  };

  await fs.writeFile(
    OUTPUT_JSON_PATH,
    JSON.stringify(statistics, null, 2),
    "utf-8",
  );

  await fs.writeFile(OUTPUT_CSV_PATH, toCsvRows(statistics), "utf-8");

  console.log(JSON.stringify(statistics.comparison, null, 2));
  console.log(`Statistics saved to ${OUTPUT_JSON_PATH}`);
  console.log(`CSV saved to ${OUTPUT_CSV_PATH}`);
}

main().catch((error) => {
  console.error("Statistics analysis failed:", error);
  process.exitCode = 1;
});