import fs from "node:fs/promises";
import path from "node:path";

const INPUT_DIR = path.join("performance-results", "scenario3");

const OUTPUT_JSON_PATH = path.join(
  "performance-results",
  "scenario3",
  "scenario3-statistics.json",
);

const OUTPUT_CSV_PATH = path.join(
  "performance-results",
  "scenario3",
  "scenario3-statistics.csv",
);

const MODES = ["baseline", "optimized"];

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
    ci95Low: round(ci95.low),
    ci95High: round(ci95.high),
    ci95HalfWidth: round(ci95.halfWidth),
  };
}

function getUpdateToNextPaintValues(result) {
  return result.customMeasures
    .filter((measure) => measure.name.includes("update-to-next-paint"))
    .map((measure) => measure.durationMs);
}

function calculateRunMetrics(result) {
  const updateToNextPaintValues = getUpdateToNextPaintValues(result);
  const updateToNextPaintMean = mean(updateToNextPaintValues);
  const updateToNextPaintMedian = median(updateToNextPaintValues);

  const incomingUpdates = result.incomingUpdates;
  const renderedUpdates = result.renderedUpdates;

  const renderRatio =
    incomingUpdates && incomingUpdates > 0
      ? renderedUpdates / incomingUpdates
      : null;

  return {
    runIndex: result.runIndex,
    mode: result.mode,
    incomingUpdates,
    renderedUpdates,
    renderRatio: round(renderRatio, 4),
    updateToNextPaintMean: round(updateToNextPaintMean),
    updateToNextPaintMedian: round(updateToNextPaintMedian),
    updateToNextPaintCount: updateToNextPaintValues.length,
  };
}

function calculateModeStatistics(mode, runMetrics) {
  return {
    mode,
    runs: runMetrics.length,
    runMetrics,
    incomingUpdates: describe(runMetrics.map((item) => item.incomingUpdates)),
    renderedUpdates: describe(runMetrics.map((item) => item.renderedUpdates)),
    renderRatio: describe(runMetrics.map((item) => item.renderRatio)),
    updateToNextPaintMean: describe(
      runMetrics.map((item) => item.updateToNextPaintMean),
    ),
    updateToNextPaintMedian: describe(
      runMetrics.map((item) => item.updateToNextPaintMedian),
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
      ratio: null,
    };
  }

  return {
    absoluteReduction: round(baselineValue - optimizedValue),
    relativeReductionPercent: round(
      ((baselineValue - optimizedValue) / baselineValue) * 100,
    ),
    ratio: optimizedValue === 0 ? null : round(baselineValue / optimizedValue),
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

function calculateComparisonForMetric(baselineValues, optimizedValues) {
  const baselineMean = mean(baselineValues);
  const optimizedMean = mean(optimizedValues);

  return {
    ...calculateReduction(baselineMean, optimizedMean),
    pairedDifference: calculatePairedDifferenceStats(
      baselineValues,
      optimizedValues,
    ),
  };
}

function calculateComparison(baselineStats, optimizedStats) {
  return {
    incomingUpdates: calculateComparisonForMetric(
      baselineStats.runMetrics.map((item) => item.incomingUpdates),
      optimizedStats.runMetrics.map((item) => item.incomingUpdates),
    ),
    renderedUpdates: calculateComparisonForMetric(
      baselineStats.runMetrics.map((item) => item.renderedUpdates),
      optimizedStats.runMetrics.map((item) => item.renderedUpdates),
    ),
    renderRatio: calculateComparisonForMetric(
      baselineStats.runMetrics.map((item) => item.renderRatio),
      optimizedStats.runMetrics.map((item) => item.renderRatio),
    ),
    updateToNextPaintMean: calculateComparisonForMetric(
      baselineStats.runMetrics.map((item) => item.updateToNextPaintMean),
      optimizedStats.runMetrics.map((item) => item.updateToNextPaintMean),
    ),
  };
}

async function readRunResults() {
  const fileNames = await fs.readdir(INPUT_DIR);

  const resultFileNames = fileNames.filter(
    (fileName) =>
      fileName.startsWith("scenario3-") && fileName.endsWith("-result.json"),
  );

  const results = [];

  for (const fileName of resultFileNames) {
    const filePath = path.join(INPUT_DIR, fileName);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const result = JSON.parse(fileContent);

    if (!result.error) {
      results.push(result);
    }
  }

  return results.sort((a, b) => {
    if (a.runIndex !== b.runIndex) {
      return a.runIndex - b.runIndex;
    }

    return a.mode.localeCompare(b.mode);
  });
}

function makeCsv(statistics) {
  const rows = [
    [
      "metric",
      "mode",
      "runs",
      "mean",
      "median",
      "standardDeviation",
      "standardError",
      "ci95Low",
      "ci95High",
      "ci95HalfWidth",
    ],
  ];

  const metricKeys = [
    "incomingUpdates",
    "renderedUpdates",
    "renderRatio",
    "updateToNextPaintMean",
  ];

  for (const modeStats of statistics.modes) {
    for (const metricKey of metricKeys) {
      const metric = modeStats[metricKey];

      rows.push([
        metricKey,
        modeStats.mode,
        metric.count,
        metric.mean,
        metric.median,
        metric.standardDeviation,
        metric.standardError,
        metric.ci95Low,
        metric.ci95High,
        metric.ci95HalfWidth,
      ]);
    }
  }

  return rows.map((row) => row.join(";")).join("\n");
}

async function main() {
  const results = await readRunResults();

  const baselineRuns = results
    .filter((result) => result.mode === "baseline")
    .map(calculateRunMetrics);

  const optimizedRuns = results
    .filter((result) => result.mode === "optimized")
    .map(calculateRunMetrics);

  if (baselineRuns.length === 0 || optimizedRuns.length === 0) {
    throw new Error("Both baseline and optimized result files are required.");
  }

  const baselineStats = calculateModeStatistics("baseline", baselineRuns);
  const optimizedStats = calculateModeStatistics("optimized", optimizedRuns);

  const statistics = {
    scenario: "scenario3",
    interpretationUnit:
      "One run is treated as one independent observation. Update-to-next-paint values inside one run are aggregated first.",
    modes: [baselineStats, optimizedStats],
    comparison: calculateComparison(baselineStats, optimizedStats),
  };

  await fs.writeFile(
    OUTPUT_JSON_PATH,
    JSON.stringify(statistics, null, 2),
    "utf-8",
  );

  await fs.writeFile(OUTPUT_CSV_PATH, makeCsv(statistics), "utf-8");

  console.log(JSON.stringify(statistics.comparison, null, 2));
  console.log(`Statistics saved to ${OUTPUT_JSON_PATH}`);
  console.log(`CSV saved to ${OUTPUT_CSV_PATH}`);
}

main().catch((error) => {
  console.error("Statistics analysis failed:", error);
  process.exitCode = 1;
});