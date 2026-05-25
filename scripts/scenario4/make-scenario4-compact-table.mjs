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

function formatMeanWithSd(mean, sd, unit) {
  return `${formatNumber(mean)} ± ${formatNumber(sd)} ${unit}`;
}

function formatConfidenceInterval(low, high) {
  return `[${formatNumber(low)}; ${formatNumber(high)}]`;
}

function formatPValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value === 0) {
    return "p < 0,0001";
  }

  return formatNumber(value);
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
  const differenceStats = comparison.pairedDifferenceStats;

  const row = {
    metric: "input-to-next-paint",
    baselineMean: baseline.perRunMeans.meanMs,
    baselineSd: baseline.perRunMeans.standardDeviationMs,
    baselineMedian: baseline.perRunMeans.medianMs,
    optimizedMean: optimized.perRunMeans.meanMs,
    optimizedSd: optimized.perRunMeans.standardDeviationMs,
    optimizedMedian: optimized.perRunMeans.medianMs,
    absoluteReduction: comparison.absoluteReductionMs,
    relativeReductionPercent: comparison.relativeReductionPercent,
    speedupRatio: comparison.speedupRatio,
    ci95: formatConfidenceInterval(
      differenceStats.ci95LowMs,
      differenceStats.ci95HighMs,
    ),
    pValue: differenceStats.pValue,
    unit: "мс",
  };

  const markdownTable = [
    "### Таблица X - Описательная статистика четвертого сценария",
    "",
    "| Метрика | Baseline, среднее ± SD | Baseline, медиана | Optimized, среднее ± SD | Optimized, медиана |",
    "|---|---:|---:|---:|---:|",
    `| ${row.metric} | ${formatMeanWithSd(
      row.baselineMean,
      row.baselineSd,
      row.unit,
    )} | ${formatNumber(row.baselineMedian)} ${row.unit} | ${formatMeanWithSd(
      row.optimizedMean,
      row.optimizedSd,
      row.unit,
    )} | ${formatNumber(row.optimizedMedian)} ${row.unit} |`,
    "",
    "### Таблица X - Проверка различий между базовой и оптимизированной реализациями в четвертом сценарии",
    "",
    "| Метрика | Абсолютное снижение | Относительное снижение | Ускорение | 95% ДИ разницы | p-value |",
    "|---|---:|---:|---:|---:|---:|",
    `| ${row.metric} | ${formatNumber(row.absoluteReduction)} ${
      row.unit
    } | ${formatNumber(row.relativeReductionPercent)}% | ${formatNumber(
      row.speedupRatio,
    )} раза | ${row.ci95} ${row.unit} | ${formatPValue(row.pValue)} |`,
  ].join("\n");

  const csvRows = [
    [
      "Метрика",
      "Baseline, среднее ± SD",
      "Baseline, медиана",
      "Optimized, среднее ± SD",
      "Optimized, медиана",
      "Абсолютное снижение",
      "Относительное снижение",
      "Ускорение",
      "95% ДИ разницы",
      "p-value",
      "Единица",
    ],
    [
      row.metric,
      `${formatNumber(row.baselineMean)} ± ${formatNumber(row.baselineSd)}`,
      formatNumber(row.baselineMedian),
      `${formatNumber(row.optimizedMean)} ± ${formatNumber(row.optimizedSd)}`,
      formatNumber(row.optimizedMedian),
      formatNumber(row.absoluteReduction),
      `${formatNumber(row.relativeReductionPercent)}%`,
      formatNumber(row.speedupRatio),
      row.ci95,
      formatPValue(row.pValue),
      row.unit,
    ],
  ];

  const csvContent = csvRows.map((csvRow) => csvRow.join(";")).join("\n");

  await fs.writeFile(OUTPUT_MARKDOWN_PATH, markdownTable, "utf-8");
  await fs.writeFile(OUTPUT_CSV_PATH, csvContent, "utf-8");

  console.log(`Markdown table saved to ${OUTPUT_MARKDOWN_PATH}`);
  console.log(`CSV table saved to ${OUTPUT_CSV_PATH}`);
}

main().catch((error) => {
  console.error("Compact table generation failed:", error);
  process.exitCode = 1;
});