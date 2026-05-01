import fs from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(
  "performance-results",
  "scenario1",
  "scenario1-statistics.json",
);

const OUTPUT_MARKDOWN_PATH = path.join(
  "performance-results",
  "scenario1",
  "scenario1-compact-table.md",
);

const OUTPUT_CSV_PATH = path.join(
  "performance-results",
  "scenario1",
  "scenario1-compact-table.csv",
);

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(".", ",");
}

function formatConfidenceInterval(low, high) {
  return `[${formatNumber(low)}; ${formatNumber(high)}]`;
}

function makeMetricRow({
  metricName,
  baselineStats,
  optimizedStats,
  comparison,
  unit,
}) {
  const baselineMean = baselineStats.mean;
  const optimizedMean = optimizedStats.mean;
  const baselineMedian = baselineStats.median;
  const optimizedMedian = optimizedStats.median;

  return {
    metricName,
    baselineMean,
    baselineMedian,
    optimizedMean,
    optimizedMedian,
    absoluteReduction: comparison.absoluteReduction,
    relativeReductionPercent: comparison.relativeReductionPercent,
    ci95: formatConfidenceInterval(
      comparison.pairedDifference.statistics.ci95Low,
      comparison.pairedDifference.statistics.ci95High,
    ),
    unit,
  };
}

async function main() {
  const fileContent = await fs.readFile(INPUT_PATH, "utf-8");
  const statistics = JSON.parse(fileContent);

  const baseline = statistics.modes.find((item) => item.mode === "baseline");
  const optimized = statistics.modes.find((item) => item.mode === "optimized");

  if (!baseline || !optimized) {
    throw new Error("Baseline and optimized statistics are required.");
  }

  const comparison = statistics.comparison;

  const rows = [
    makeMetricRow({
      metricName: "input-to-next-paint",
      baselineStats: baseline.inputToNextPaint.perRunMeans,
      optimizedStats: optimized.inputToNextPaint.perRunMeans,
      comparison: comparison.inputToNextPaint.meanBasedDifference,
      unit: "мс",
    }),
    makeMetricRow({
      metricName: "unrelated-update-to-next-paint",
      baselineStats: baseline.unrelatedUpdateToNextPaint.perRunMeans,
      optimizedStats: optimized.unrelatedUpdateToNextPaint.perRunMeans,
      comparison: comparison.unrelatedUpdateToNextPaint.meanBasedDifference,
      unit: "мс",
    }),
    makeMetricRow({
      metricName: "expensiveFilterAndSort при вводе",
      baselineStats: baseline.expensiveCallsDuringInput.perRunStatistics,
      optimizedStats: optimized.expensiveCallsDuringInput.perRunStatistics,
      comparison: comparison.expensiveCallsDuringInput.meanBasedDifference,
      unit: "выз.",
    }),
    makeMetricRow({
      metricName: "expensiveFilterAndSort при unrelated update",
      baselineStats: baseline.expensiveCallsDuringUnrelated.perRunStatistics,
      optimizedStats: optimized.expensiveCallsDuringUnrelated.perRunStatistics,
      comparison: comparison.expensiveCallsDuringUnrelated.meanBasedDifference,
      unit: "выз.",
    }),
  ];

  const markdownTable = [
    "| Метрика | Baseline, среднее | Baseline, медиана | Optimized, среднее | Optimized, медиана | Абсолютное снижение | Относительное снижение | 95% ДИ разницы |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) =>
      [
        row.metricName,
        `${formatNumber(row.baselineMean)} ${row.unit}`,
        `${formatNumber(row.baselineMedian)} ${row.unit}`,
        `${formatNumber(row.optimizedMean)} ${row.unit}`,
        `${formatNumber(row.optimizedMedian)} ${row.unit}`,
        `${formatNumber(row.absoluteReduction)} ${row.unit}`,
        `${formatNumber(row.relativeReductionPercent)}%`,
        `${row.ci95} ${row.unit}`,
      ].join(" | "),
    ).map((row) => `| ${row} |`),
  ].join("\n");

  const csvRows = [
    [
      "Метрика",
      "Baseline, среднее",
      "Baseline, медиана",
      "Optimized, среднее",
      "Optimized, медиана",
      "Абсолютное снижение",
      "Относительное снижение",
      "95% ДИ разницы",
      "Единица",
    ],
    ...rows.map((row) => [
      row.metricName,
      formatNumber(row.baselineMean),
      formatNumber(row.baselineMedian),
      formatNumber(row.optimizedMean),
      formatNumber(row.optimizedMedian),
      formatNumber(row.absoluteReduction),
      `${formatNumber(row.relativeReductionPercent)}%`,
      row.ci95,
      row.unit,
    ]),
  ];

  const csvContent = csvRows.map((row) => row.join(";")).join("\n");

  await fs.writeFile(OUTPUT_MARKDOWN_PATH, markdownTable, "utf-8");
  await fs.writeFile(OUTPUT_CSV_PATH, csvContent, "utf-8");

  console.log(`Markdown table saved to ${OUTPUT_MARKDOWN_PATH}`);
  console.log(`CSV table saved to ${OUTPUT_CSV_PATH}`);
}

main().catch((error) => {
  console.error("Compact table generation failed:", error);
  process.exitCode = 1;
});