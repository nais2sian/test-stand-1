import fs from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(
  "performance-results",
  "scenario4",
  "scenario4-statistics.json",
);

const OUTPUT_MARKDOWN_PATH = path.join(
  "performance-results",
  "scenario4",
  "scenario4-compact-table.md",
);

const OUTPUT_CSV_PATH = path.join(
  "performance-results",
  "scenario4",
  "scenario4-compact-table.csv",
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

async function main() {
  const fileContent = await fs.readFile(INPUT_PATH, "utf-8");
  const statistics = JSON.parse(fileContent);

  const baseline = statistics.modes.find((item) => item.mode === "baseline");
  const optimized = statistics.modes.find((item) => item.mode === "optimized");

  if (!baseline || !optimized) {
    throw new Error("Baseline and optimized statistics are required.");
  }

  const comparison = statistics.comparison.meanBasedDifference;

  const rows = [
    {
      mode: "Baseline",
      runs: baseline.perRunMeans.count,
      meanMs: baseline.perRunMeans.meanMs,
      medianMs: baseline.perRunMeans.medianMs,
      standardDeviationMs: baseline.perRunMeans.standardDeviationMs,
      ci95: formatConfidenceInterval(
        baseline.perRunMeans.ci95LowMs,
        baseline.perRunMeans.ci95HighMs,
      ),
    },
    {
      mode: "Optimized",
      runs: optimized.perRunMeans.count,
      meanMs: optimized.perRunMeans.meanMs,
      medianMs: optimized.perRunMeans.medianMs,
      standardDeviationMs: optimized.perRunMeans.standardDeviationMs,
      ci95: formatConfidenceInterval(
        optimized.perRunMeans.ci95LowMs,
        optimized.perRunMeans.ci95HighMs,
      ),
    },
  ];

  const markdownTable = [
    "| Вариант | Число прогонов | Среднее, мс | Медиана, мс | Стандартное отклонение, мс | 95% доверительный интервал, мс |",
    "|---|---:|---:|---:|---:|---:|",
    ...rows.map((row) =>
      [
        row.mode,
        row.runs,
        formatNumber(row.meanMs),
        formatNumber(row.medianMs),
        formatNumber(row.standardDeviationMs),
        row.ci95,
      ].join(" | "),
    ).map((row) => `| ${row} |`),
    "",
    "| Показатель | Значение |",
    "|---|---:|",
    `| Абсолютное снижение задержки | ${formatNumber(
      comparison.absoluteReductionMs,
    )} мс |`,
    `| Относительное снижение | ${formatNumber(
      comparison.relativeReductionPercent,
    )}% |`,
    `| Ускорение | ${formatNumber(comparison.speedupRatio)} раза |`,
    `| 95% доверительный интервал разницы | ${formatConfidenceInterval(
      comparison.pairedDifferenceStats.ci95LowMs,
      comparison.pairedDifferenceStats.ci95HighMs,
    )} мс |`,
  ].join("\n");

  const csvRows = [
    [
      "Вариант",
      "Число прогонов",
      "Среднее, мс",
      "Медиана, мс",
      "Стандартное отклонение, мс",
      "95% доверительный интервал, мс",
    ],
    ...rows.map((row) => [
      row.mode,
      row.runs,
      formatNumber(row.meanMs),
      formatNumber(row.medianMs),
      formatNumber(row.standardDeviationMs),
      row.ci95,
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