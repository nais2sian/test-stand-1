import fs from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(
  "performance-results",
  "scenario1",
  "scenario1-summary.json",
);

const OUTPUT_JSON_PATH = path.join(
  "performance-results",
  "scenario1",
  "scenario1-statistics.json",
);

const OUTPUT_CSV_PATH = path.join(
  "performance-results",
  "scenario1",
  "scenario1-statistics.csv",
);

const INPUT_TEXT_LENGTH = 5;
const UNRELATED_UPDATES_COUNT = 5;

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
  if (value === null || value === undefined || Number.isNaN(value)) {
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
  const cleanValues = values.filter(
    (value) => value !== null && value !== undefined && !Number.isNaN(value),
  );

  if (cleanValues.length === 0) {
    return {
      count: 0,
      mean: null,
      median: null,
      standardDeviation: null,
      standardError: null,
      min: null,
      max: null,
      p75: null,
      p90: null,
      p95: null,
      ci95Low: null,
      ci95High: null,
      ci95HalfWidth: null,
    };
  }

  const ci95 = confidenceInterval95(cleanValues);

  return {
    count: cleanValues.length,
    mean: round(mean(cleanValues)),
    median: round(median(cleanValues)),
    standardDeviation: round(standardDeviation(cleanValues)),
    standardError: round(standardError(cleanValues)),
    min: round(Math.min(...cleanValues)),
    max: round(Math.max(...cleanValues)),
    p75: round(percentile(cleanValues, 0.75)),
    p90: round(percentile(cleanValues, 0.9)),
    p95: round(percentile(cleanValues, 0.95)),
    ci95Low: round(ci95.low),
    ci95High: round(ci95.high),
    ci95HalfWidth: round(ci95.halfWidth),
  };
}

function calculateTimedMetric(values, chunkSize) {
  const runChunks = chunk(values, chunkSize);

  const perRunMeans = runChunks.map((runValues) => mean(runValues));
  const perRunMedians = runChunks.map((runValues) => median(runValues));

  return {
    rawMeasurements: describe(values),
    perRunMeans: describe(perRunMeans),
    perRunMedians: describe(perRunMedians),
    perRunMeanValues: perRunMeans.map((value) => round(value)),
    perRunMedianValues: perRunMedians.map((value) => round(value)),
  };
}

function calculateCounterMetric(values) {
  return {
    perRunValues: values.map((value) => round(value)),
    perRunStatistics: describe(values),
  };
}

function calculateModeStatistics(summaryItem) {
  return {
    scenario: summaryItem.scenario,
    mode: summaryItem.mode,
    runs: summaryItem.runs,

    inputToNextPaint: calculateTimedMetric(
      summaryItem.inputToNextPaintValues,
      INPUT_TEXT_LENGTH,
    ),

    unrelatedUpdateToNextPaint: calculateTimedMetric(
      summaryItem.unrelatedUpdateToNextPaintValues,
      UNRELATED_UPDATES_COUNT,
    ),

    expensiveCallsDuringInput: calculateCounterMetric(
      summaryItem.expensiveCallsDuringInputValues,
    ),

    expensiveCallsDuringUnrelated: calculateCounterMetric(
      summaryItem.expensiveCallsDuringUnrelatedValues,
    ),

    finalExpensiveCallCount: calculateCounterMetric(
      summaryItem.finalExpensiveCallCountValues,
    ),
  };
}

function calculateReduction(baselineValue, optimizedValue) {
  if (
    baselineValue === null ||
    optimizedValue === null ||
    baselineValue === 0
  ) {
    return {
      absoluteReduction: null,
      relativeReductionPercent: null,
      speedupRatio: null,
    };
  }

  return {
    absoluteReduction: round(baselineValue - optimizedValue),
    relativeReductionPercent: round(
      ((baselineValue - optimizedValue) / baselineValue) * 100,
    ),
    speedupRatio: optimizedValue === 0 ? null : round(baselineValue / optimizedValue),
  };
}

function calculatePairedDifferenceStats(baselineValues, optimizedValues) {
  const pairCount = Math.min(baselineValues.length, optimizedValues.length);

  const differences = Array.from({ length: pairCount }, (_, index) => {
    return baselineValues[index] - optimizedValues[index];
  });

  return {
    values: differences.map((value) => round(value)),
    statistics: describe(differences),
  };
}

function calculateTimedComparison(baselineMetric, optimizedMetric) {
  const baselineMean = baselineMetric.perRunMeans.mean;
  const optimizedMean = optimizedMetric.perRunMeans.mean;

  const baselineMedian = baselineMetric.perRunMedians.mean;
  const optimizedMedian = optimizedMetric.perRunMedians.mean;

  return {
    meanBasedDifference: {
      ...calculateReduction(baselineMean, optimizedMean),
      pairedDifference: calculatePairedDifferenceStats(
        baselineMetric.perRunMeanValues,
        optimizedMetric.perRunMeanValues,
      ),
    },
    medianBasedDifference: {
      ...calculateReduction(baselineMedian, optimizedMedian),
      pairedDifference: calculatePairedDifferenceStats(
        baselineMetric.perRunMedianValues,
        optimizedMetric.perRunMedianValues,
      ),
    },
  };
}

function calculateCounterComparison(baselineMetric, optimizedMetric) {
  const baselineMean = baselineMetric.perRunStatistics.mean;
  const optimizedMean = optimizedMetric.perRunStatistics.mean;

  return {
    meanBasedDifference: {
      ...calculateReduction(baselineMean, optimizedMean),
      pairedDifference: calculatePairedDifferenceStats(
        baselineMetric.perRunValues,
        optimizedMetric.perRunValues,
      ),
    },
  };
}

function calculateComparison(baselineStats, optimizedStats) {
  return {
    inputToNextPaint: calculateTimedComparison(
      baselineStats.inputToNextPaint,
      optimizedStats.inputToNextPaint,
    ),
    unrelatedUpdateToNextPaint: calculateTimedComparison(
      baselineStats.unrelatedUpdateToNextPaint,
      optimizedStats.unrelatedUpdateToNextPaint,
    ),
    expensiveCallsDuringInput: calculateCounterComparison(
      baselineStats.expensiveCallsDuringInput,
      optimizedStats.expensiveCallsDuringInput,
    ),
    expensiveCallsDuringUnrelated: calculateCounterComparison(
      baselineStats.expensiveCallsDuringUnrelated,
      optimizedStats.expensiveCallsDuringUnrelated,
    ),
    finalExpensiveCallCount: calculateCounterComparison(
      baselineStats.finalExpensiveCallCount,
      optimizedStats.finalExpensiveCallCount,
    ),
  };
}

function toCsvRows(statistics) {
  const rows = [
    [
      "scenario",
      "mode",
      "metric",
      "level",
      "count",
      "mean",
      "median",
      "standardDeviation",
      "standardError",
      "min",
      "max",
      "p75",
      "p90",
      "p95",
      "ci95Low",
      "ci95High",
      "ci95HalfWidth",
    ],
  ];

  for (const item of statistics.modes) {
    const metricEntries = [
      ["inputToNextPaint", item.inputToNextPaint.perRunMeans],
      ["unrelatedUpdateToNextPaint", item.unrelatedUpdateToNextPaint.perRunMeans],
      [
        "expensiveCallsDuringInput",
        item.expensiveCallsDuringInput.perRunStatistics,
      ],
      [
        "expensiveCallsDuringUnrelated",
        item.expensiveCallsDuringUnrelated.perRunStatistics,
      ],
      ["finalExpensiveCallCount", item.finalExpensiveCallCount.perRunStatistics],
    ];

    for (const [metric, stats] of metricEntries) {
      rows.push([
        item.scenario,
        item.mode,
        metric,
        "perRun",
        stats.count,
        stats.mean,
        stats.median,
        stats.standardDeviation,
        stats.standardError,
        stats.min,
        stats.max,
        stats.p75,
        stats.p90,
        stats.p95,
        stats.ci95Low,
        stats.ci95High,
        stats.ci95HalfWidth,
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
    scenario: "scenario1",
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