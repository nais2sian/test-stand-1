import fs from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(
  "performance-results",
  "scenario3",
  "scenario3-statistics.json",
);

const OUTPUT_MARKDOWN_PATH = path.join(
  "performance-results",
  "scenario3",
  "scenario3-compact-table.md",
);

const OUTPUT_CSV_PATH = path.join(
  "performance-results",
  "scenario3",
  "scenario3-compact-table.csv",
);

const METRICS = [
  {
    key: "incomingUpdates",
    label: "Входящие обновления",
    unit: "обн.",
  },
  {
    key: "renderedUpdates",
    label: "Визуальные обновления",
    unit: "обн.",
  },
  {
    key: "renderRatio",
    label: "Доля визуальных обновлений",
    unit: "",
  },
  {
    key: "updateToNextPaintMean",
    label: "update-to-next-paint",
    unit: "мс",
  },
];

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(".", ",");
}

function formatUnit(value, unit) {
  if (value === null || value === undefined) {
    return "";
  }

  if (!unit) {
    return formatNumber(value);
  }

  return `${formatNumber(value)} ${unit}`;
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return `${formatNumber(value)}%`;
}

function formatConfidenceInterval(low, high, unit) {
  const interval = `[${formatNumber(low)}; ${formatNumber(high)}]`;

  if (!unit) {
    return interval;
  }

  return `${interval} ${unit}`;
}

function getMode(statistics, mode) {
  const modeStats = statistics.modes.find((item) => item.mode === mode);

  if (!modeStats) {
    throw new Error(`Missing ${mode} statistics.`);
  }

  return modeStats;
}

function makeMainComparisonTable(statistics) {
  const baseline = getMode(statistics, "baseline");
  const optimized = getMode(statistics, "optimized");

  const rows = METRICS.map((metricConfig) => {
    const baselineMetric = baseline[metricConfig.key];
    const optimizedMetric = optimized[metricConfig.key];
    const comparison = statistics.comparison[metricConfig.key];

    return [
      metricConfig.label,
      formatUnit(baselineMetric.mean, metricConfig.unit),
      formatUnit(optimizedMetric.mean, metricConfig.unit),
      formatUnit(comparison.absoluteReduction, metricConfig.unit),
      formatPercent(comparison.relativeReductionPercent),
    ];
  });

  return [
    "### Таблица X - Ключевые показатели третьего сценария",
    "",
    "| Показатель | Базовый вариант | Оптимизированный вариант | Абсолютное снижение | Относительное снижение |",
    "|---|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function makeTimeMetricTable(statistics) {
  const baseline = getMode(statistics, "baseline");
  const optimized = getMode(statistics, "optimized");

  const baselineStats = baseline.updateToNextPaintMean;
  const optimizedStats = optimized.updateToNextPaintMean;

  return [
    "### Таблица X - Временная метрика третьего сценария",
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
      "мс",
    )} |`,
    `| Оптимизированный | ${optimizedStats.count} | ${formatNumber(
      optimizedStats.mean,
    )} | ${formatNumber(optimizedStats.median)} | ${formatNumber(
      optimizedStats.standardDeviation,
    )} | ${formatConfidenceInterval(
      optimizedStats.ci95Low,
      optimizedStats.ci95High,
      "мс",
    )} |`,
  ].join("\n");
}

function makeUpdateDifferenceTable(statistics) {
  const renderedComparison = statistics.comparison.renderedUpdates;
  const timeComparison = statistics.comparison.updateToNextPaintMean;
  const timeDifference = timeComparison.pairedDifference.statistics;

  return [
    "### Таблица X - Проверка различий третьего сценария",
    "",
    "| Показатель | Значение |",
    "|---|---:|",
    `| Снижение числа визуальных обновлений | ${formatUnit(
      renderedComparison.absoluteReduction,
      "обн.",
    )} |`,
    `| Относительное снижение визуальных обновлений | ${formatPercent(
      renderedComparison.relativeReductionPercent,
    )} |`,
    `| Абсолютное снижение update-to-next-paint | ${formatUnit(
      timeComparison.absoluteReduction,
      "мс",
    )} |`,
    `| Относительное снижение update-to-next-paint | ${formatPercent(
      timeComparison.relativeReductionPercent,
    )} |`,
    `| 95% доверительный интервал разницы update-to-next-paint | ${formatConfidenceInterval(
      timeDifference.ci95Low,
      timeDifference.ci95High,
      "мс",
    )} |`,
  ].join("\n");
}

function makeMarkdownTable(statistics) {
  return [
    makeMainComparisonTable(statistics),
    "",
    makeTimeMetricTable(statistics),
    "",
    makeUpdateDifferenceTable(statistics),
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
    const baselineMetric = baseline[metricConfig.key];
    const optimizedMetric = optimized[metricConfig.key];
    const comparison = statistics.comparison[metricConfig.key];

    rows.push([
      metricConfig.label,
      formatNumber(baselineMetric.mean),
      formatNumber(optimizedMetric.mean),
      formatNumber(comparison.absoluteReduction),
      formatPercent(comparison.relativeReductionPercent),
      metricConfig.unit,
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