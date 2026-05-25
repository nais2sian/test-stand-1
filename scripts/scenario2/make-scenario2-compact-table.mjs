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

function getMode(statistics, mode) {
  const modeStats = statistics.modes.find((item) => item.mode === mode);

  if (!modeStats) {
    throw new Error(`Missing ${mode} statistics.`);
  }

  return modeStats;
}

function makeRows(statistics) {
  const baseline = getMode(statistics, "baseline");
  const optimized = getMode(statistics, "optimized");

  return METRICS.map((metricConfig) => {
    const baselineMetric = baseline.metrics[metricConfig.key];
    const optimizedMetric = optimized.metrics[metricConfig.key];
    const comparison = statistics.comparison[metricConfig.key];

    const baselineStats = baselineMetric.perRunStatistics;
    const optimizedStats = optimizedMetric.perRunStatistics;
    const differenceStats = comparison.pairedDifference.statistics;

    return {
      metric: metricConfig.label,
      unit: comparison.unit,

      baselineMean: baselineStats.mean,
      baselineSd: baselineStats.standardDeviation,
      baselineMedian: baselineStats.median,

      optimizedMean: optimizedStats.mean,
      optimizedSd: optimizedStats.standardDeviation,
      optimizedMedian: optimizedStats.median,

      absoluteReduction: comparison.absoluteReduction,
      relativeReductionPercent: comparison.relativeReductionPercent,
      ratio: comparison.ratio,

      ci95Low: differenceStats.ci95Low,
      ci95High: differenceStats.ci95High,
      pValue: differenceStats.pValue,
    };
  });
}

function makeDescriptiveTable(rows) {
  return [
    "### Таблица X - Описательная статистика второго сценария",
    "",
    "| Метрика | Baseline, среднее ± SD | Baseline, медиана | Optimized, среднее ± SD | Optimized, медиана |",
    "|---|---:|---:|---:|---:|",
    ...rows.map((row) =>
      [
        row.metric,
        formatMeanWithSd(row.baselineMean, row.baselineSd, row.unit),
        `${formatNumber(row.baselineMedian)} ${row.unit}`,
        formatMeanWithSd(row.optimizedMean, row.optimizedSd, row.unit),
        `${formatNumber(row.optimizedMedian)} ${row.unit}`,
      ].join(" | "),
    ).map((row) => `| ${row} |`),
  ].join("\n");
}

function makeComparisonTable(rows) {
  return [
    "### Таблица X - Проверка различий между базовой и оптимизированной реализациями во втором сценарии",
    "",
    "| Метрика | Абсолютное снижение | Относительное снижение | 95% ДИ разницы | p-value |",
    "|---|---:|---:|---:|---:|",
    ...rows.map((row) =>
      [
        row.metric,
        `${formatNumber(row.absoluteReduction)} ${row.unit}`,
        `${formatNumber(row.relativeReductionPercent)}%`,
        `${formatConfidenceInterval(row.ci95Low, row.ci95High)} ${row.unit}`,
        formatPValue(row.pValue),
      ].join(" | "),
    ).map((row) => `| ${row} |`),
  ].join("\n");
}

function makeMarkdownTable(statistics) {
  const rows = makeRows(statistics);

  return [
    makeDescriptiveTable(rows),
    "",
    makeComparisonTable(rows),
  ].join("\n");
}

function makeCsv(statistics) {
  const rows = makeRows(statistics);

  const csvRows = [
    [
      "Метрика",
      "Baseline, среднее ± SD",
      "Baseline, медиана",
      "Optimized, среднее ± SD",
      "Optimized, медиана",
      "Абсолютное снижение",
      "Относительное снижение",
      "95% ДИ разницы",
      "p-value",
      "Единица",
    ],
    ...rows.map((row) => [
      row.metric,
      `${formatNumber(row.baselineMean)} ± ${formatNumber(row.baselineSd)}`,
      formatNumber(row.baselineMedian),
      `${formatNumber(row.optimizedMean)} ± ${formatNumber(row.optimizedSd)}`,
      formatNumber(row.optimizedMedian),
      formatNumber(row.absoluteReduction),
      `${formatNumber(row.relativeReductionPercent)}%`,
      formatConfidenceInterval(row.ci95Low, row.ci95High),
      formatPValue(row.pValue),
      row.unit,
    ]),
  ];

  return csvRows.map((row) => row.join(";")).join("\n");
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