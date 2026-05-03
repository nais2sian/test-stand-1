import fs from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(
  "performance-results",
  "scenario2",
  "scenario2-summary.json",
);

const OUTPUT_JSON_PATH = path.join(
  "performance-results",
  "scenario2",
  "scenario2-statistics.json",
);

const OUTPUT_CSV_PATH = path.join(
  "performance-results",
  "scenario2",
  "scenario2-statistics.csv",
);

const SCROLL_STEPS_COUNT = 5;

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

const METRICS = [
  {
    key: "scrollToNextPaint",
    label: "scroll-to-next-paint",
    sourceKey: "scrollToNextPaintValues",
    chunkSize: SCROLL_STEPS_COUNT,
    unit: "мс",
  },
  {
    key: "initialRenderedRows",
    label: "Строки в DOM после загрузки",
    sourceKey: "initialRenderedRowsValues",
    chunkSize: 1,
    unit: "стр.",
  },
  {
    key: "renderedRowsDuringScroll",
    label: "Строки в DOM при прокрутке",
    sourceKey: "renderedRowsDuringScrollValues",
    chunkSize: SCROLL_STEPS_COUNT,
    unit: "стр.",
  },
  {
    key: "initialDomNodes",
    label: "DOM-узлы после загрузки",
    sourceKey: "initialDomNodesValues",
    chunkSize: 1,
    unit: "узл.",
  },
];

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

function calculatePerRunValues(values, chunkSize) {
  return chunk(values, chunkSize).map((runValues) => mean(runValues));
}

function calculateMetricStatistics(summaryItem, metricConfig) {
  const values = summaryItem[metricConfig.sourceKey] ?? [];
  const perRunValues = calculatePerRunValues(values, metricConfig.chunkSize);

  return {
    label: metricConfig.label,
    unit: metricConfig.unit,
    perRunValues: perRunValues.map((value) => round(value)),
    perRunStatistics: describe(perRunValues),
  };
}

function calculateModeStatistics(summaryItem) {
  const metrics = {};

  for (const metricConfig of METRICS) {
    metrics[metricConfig.key] = calculateMetricStatistics(
      summaryItem,
      metricConfig,
    );
  }

  return {
    scenario: summaryItem.scenario,
    mode: summaryItem.mode,
    runs: summaryItem.runs,
    metrics,
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

function calculateMetricComparison(baselineMetric, optimizedMetric) {
  const baselineMean = baselineMetric.perRunStatistics.mean;
  const optimizedMean = optimizedMetric.perRunStatistics.mean;

  return {
    ...calculateReduction(baselineMean, optimizedMean),
    pairedDifference: calculatePairedDifferenceStats(
      baselineMetric.perRunValues,
      optimizedMetric.perRunValues,
    ),
  };
}

function calculateComparison(baselineStats, optimizedStats) {
  const comparison = {};

  for (const metricConfig of METRICS) {
    comparison[metricConfig.key] = {
      label: metricConfig.label,
      unit: metricConfig.unit,
      ...calculateMetricComparison(
        baselineStats.metrics[metricConfig.key],
        optimizedStats.metrics[metricConfig.key],
      ),
    };
  }

  return comparison;
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
      "unit",
    ],
  ];

  for (const modeStats of statistics.modes) {
    for (const metricConfig of METRICS) {
      const metric = modeStats.metrics[metricConfig.key];
      const stats = metric.perRunStatistics;

      rows.push([
        metricConfig.label,
        modeStats.mode,
        stats.count,
        stats.mean,
        stats.median,
        stats.standardDeviation,
        stats.standardError,
        stats.ci95Low,
        stats.ci95High,
        stats.ci95HalfWidth,
        metricConfig.unit,
      ]);
    }
  }

  return rows.map((row) => row.join(";")).join("\n");
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
    scenario: "scenario2",
    interpretationUnit:
      "One run is treated as one independent observation. Five scroll measurements inside one run are aggregated first.",
    modes: modeStatistics,
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