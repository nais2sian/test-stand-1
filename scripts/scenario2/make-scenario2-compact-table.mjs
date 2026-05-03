import fs from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(
  "performance-results",
  "scenario2",
  "scenario2-statistics.json",
);

const OUTPUT_MARKDOWN_PATH = path.join(
  "performance-results",
  "scenario2",
  "scenario2-compact-table.md",
);

const OUTPUT_CSV_PATH = path.join(
  "performance-results",
  "scenario2",
  "scenario2-compact-table.csv",
);

const METRICS = [
  {
    key: "scrollToNextPaint",
    label: "scroll-to-next-paint",
  },
  {
    key: "initialRenderedRows",
    label: "Строки в DOM после загрузки",
  },
  {
    key: "renderedRowsDuringScroll",
    label: "Строки в DOM при прокрутке",
  },
  {
    key: "initialDomNodes",
    label: "DOM-узлы после загрузки",
  },
];

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(".", ",");
}

function formatConfidenceInterval(low, high) {
  return `[${formatNumber(low)}; ${formatNumber(high)}]`;
}

function getMode(statistics, mode) {
  const modeStats = statistics.modes.find((item) => item.mode === mode);

  if (!modeStats) {
    throw new Error(`Missing ${mode} statistics.`);
  }

  return modeStats;
}

function makeTimeMetricTable(statistics) {
  const baseline = getMode(statistics, "baseline");
  const optimized = getMode(statistics, "optimized");

  const baselineStats =
    baseline.metrics.scrollToNextPaint.perRunStatistics;
  const optimizedStats =
    optimized.metrics.scrollToNextPaint.perRunStatistics;

  return [
    "### Таблица X - Временная метрика второго сценария",
    "",
    "| Вариант | Число итераций | Среднее, мс | Медиана, мс | Стандартное отклонение, мс | 95% доверительный интервал, мс |",
    "|---|---:|---:|---:|---:|---:|",
    `| Базовый | ${baselineStats.count} | ${formatNumber(
      baselineStats.mean,
    )} | ${formatNumber(baselineStats.median)} | ${formatNumber(
      baselineStats.standardDeviation,
    )} | ${formatConfidenceInterval(
      baselineStats.ci95Low,
      baselineStats.ci95High,
    )} |`,
    `| Оптимизированный | ${optimizedStats.count} | ${formatNumber(
      optimizedStats.mean,
    )} | ${formatNumber(optimizedStats.median)} | ${formatNumber(
      optimizedStats.standardDeviation,
    )} | ${formatConfidenceInterval(
      optimizedStats.ci95Low,
      optimizedStats.ci95High,
    )} |`,
  ].join("\n");
}

function makeComparisonTable(statistics) {
  const baseline = getMode(statistics, "baseline");
  const optimized = getMode(statistics, "optimized");

  const rows = METRICS.map((metricConfig) => {
    const baselineMetric = baseline.metrics[metricConfig.key];
    const optimizedMetric = optimized.metrics[metricConfig.key];
    const comparison = statistics.comparison[metricConfig.key];

    return [
      metricConfig.label,
      `${formatNumber(baselineMetric.perRunStatistics.mean)} ${comparison.unit}`,
      `${formatNumber(optimizedMetric.perRunStatistics.mean)} ${comparison.unit}`,
      `${formatNumber(comparison.absoluteReduction)} ${comparison.unit}`,
      `${formatNumber(comparison.relativeReductionPercent)}%`,
    ];
  });

  return [
    "### Таблица X - Сравнение ключевых показателей второго сценария",
    "",
    "| Показатель | Базовый вариант | Оптимизированный вариант | Абсолютное снижение | Относительное снижение |",
    "|---|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function makeScrollDifferenceTable(statistics) {
  const comparison = statistics.comparison.scrollToNextPaint;
  const differenceStats = comparison.pairedDifference.statistics;

  return [
    "### Таблица X - Проверка различия по scroll-to-next-paint",
    "",
    "| Показатель | Значение |",
    "|---|---:|",
    `| Абсолютное снижение задержки | ${formatNumber(
      comparison.absoluteReduction,
    )} мс |`,
    `| Относительное снижение | ${formatNumber(
      comparison.relativeReductionPercent,
    )}% |`,
    `| Ускорение | ${formatNumber(comparison.ratio)} раза |`,
    `| 95% доверительный интервал разницы | ${formatConfidenceInterval(
      differenceStats.ci95Low,
      differenceStats.ci95High,
    )} мс |`,
  ].join("\n");
}

function makeMarkdownTable(statistics) {
  return [
    makeTimeMetricTable(statistics),
    "",
    makeComparisonTable(statistics),
    "",
    makeScrollDifferenceTable(statistics),
  ].join("\n");
}

function makeCsv(statistics) {
  const baseline = getMode(statistics, "baseline");
  const optimized = getMode(statistics, "optimized");

  const rows = [
    [
      "Показатель",
      "Базовый вариант",
      "Оптимизированный вариант",
      "Абсолютное снижение",
      "Относительное снижение",
      "Единица",
    ],
  ];

  for (const metricConfig of METRICS) {
    const baselineMetric = baseline.metrics[metricConfig.key];
    const optimizedMetric = optimized.metrics[metricConfig.key];
    const comparison = statistics.comparison[metricConfig.key];

    rows.push([
      metricConfig.label,
      formatNumber(baselineMetric.perRunStatistics.mean),
      formatNumber(optimizedMetric.perRunStatistics.mean),
      formatNumber(comparison.absoluteReduction),
      `${formatNumber(comparison.relativeReductionPercent)}%`,
      comparison.unit,
    ]);
  }

  return rows.map((row) => row.join(";")).join("\n");
}

async function main() {
  const fileContent = await fs.readFile(INPUT_PATH, "utf-8");
  const statistics = JSON.parse(fileContent);

  const markdownTable = makeMarkdownTable(statistics);
  const csvContent = makeCsv(statistics);

  await fs.writeFile(OUTPUT_MARKDOWN_PATH, markdownTable, "utf-8");
  await fs.writeFile(OUTPUT_CSV_PATH, csvContent, "utf-8");

  console.log(`Markdown table saved to ${OUTPUT_MARKDOWN_PATH}`);
  console.log(`CSV table saved to ${OUTPUT_CSV_PATH}`);
}

main().catch((error) => {
  console.error("Compact table generation failed:", error);
  process.exitCode = 1;
});