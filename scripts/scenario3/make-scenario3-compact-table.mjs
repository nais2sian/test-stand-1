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

function formatMeanWithSd(mean, sd, unit) {
  if (!unit) {
    return `${formatNumber(mean)} ± ${formatNumber(sd)}`;
  }

  return `${formatNumber(mean)} ± ${formatNumber(sd)} ${unit}`;
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
    const baselineStats = baseline[metricConfig.key];
    const optimizedStats = optimized[metricConfig.key];
    const comparison = statistics.comparison[metricConfig.key];
    const differenceStats = comparison.pairedDifference.statistics;

    return {
      metric: metricConfig.label,
      unit: metricConfig.unit,

      baselineMean: baselineStats.mean,
      baselineSd: baselineStats.standardDeviation,
      baselineMedian: baselineStats.median,

      optimizedMean: optimizedStats.mean,
      optimizedSd: optimizedStats.standardDeviation,
      optimizedMedian: optimizedStats.median,

      absoluteReduction: comparison.absoluteReduction,
      relativeReductionPercent: comparison.relativeReductionPercent,

      ci95Low: differenceStats.ci95Low,
      ci95High: differenceStats.ci95High,
      pValue: differenceStats.pValue,
    };
  });
}

function makeDescriptiveTable(rows) {
  return [
    "### Таблица X - Описательная статистика третьего сценария",
    "",
    "| Метрика | Baseline, среднее ± SD | Baseline, медиана | Optimized, среднее ± SD | Optimized, медиана |",
    "|---|---:|---:|---:|---:|",
    ...rows
      .map((row) =>
        [
          row.metric,
          formatMeanWithSd(row.baselineMean, row.baselineSd, row.unit),
          formatUnit(row.baselineMedian, row.unit),
          formatMeanWithSd(row.optimizedMean, row.optimizedSd, row.unit),
          formatUnit(row.optimizedMedian, row.unit),
        ].join(" | "),
      )
      .map((row) => `| ${row} |`),
  ].join("\n");
}

function makeComparisonTable(rows) {
  return [
    "### Таблица X - Проверка различий между базовой и оптимизированной реализациями в третьем сценарии",
    "",
    "| Метрика | Абсолютное снижение | Относительное снижение | 95% ДИ разницы | p-value |",
    "|---|---:|---:|---:|---:|",
    ...rows
      .map((row) =>
        [
          row.metric,
          formatUnit(row.absoluteReduction, row.unit),
          formatPercent(row.relativeReductionPercent),
          formatConfidenceInterval(row.ci95Low, row.ci95High, row.unit),
          formatPValue(row.pValue),
        ].join(" | "),
      )
      .map((row) => `| ${row} |`),
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
      formatPercent(row.relativeReductionPercent),
      formatConfidenceInterval(row.ci95Low, row.ci95High, ""),
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