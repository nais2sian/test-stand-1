import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const BASE_URL = "http://localhost:4173";
const OUTPUT_DIR = path.join("performance-results", "scenario2");

const SCENARIO = "scenario2";
const MODES = ["baseline", "optimized"];
const RUNS_COUNT = 10;
const SCROLL_STEPS_COUNT = 5;
const AFTER_PAGE_LOAD_WAIT_MS = 1000;
const AFTER_SCROLL_WAIT_MS = 300;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function extractProfilerEntryFromConsole(text) {
  const match = text.match(
    /\[Profiler\]\[(.+?)\]\s+(.+?)\s+duration:\s+([\d.]+)\s+ms/,
  );

  if (!match) {
    return null;
  }

  return {
    id: match[1],
    phase: match[2],
    durationMs: Number(match[3]),
  };
}

function calculateAverage(values) {
  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((total, value) => total + value, 0);

  return Number((sum / values.length).toFixed(2));
}

function calculateMedian(values) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    const left = sortedValues[middleIndex - 1];
    const right = sortedValues[middleIndex];

    return Number(((left + right) / 2).toFixed(2));
  }

  return Number(sortedValues[middleIndex].toFixed(2));
}

async function getMaxScrollTop(page, mode) {
  return page.evaluate((currentMode) => {
    if (currentMode === "optimized") {
      const container = document.querySelector(
        '[data-testid="scenario2-scroll-container"]',
      );

      if (!container) {
        return 0;
      }

      return Math.max(0, container.scrollHeight - container.clientHeight);
    }

    const scrollElement = document.scrollingElement ?? document.documentElement;

    return Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
  }, mode);
}

async function measureScrollToNextPaint(page, { mode, scrollTop, stepIndex }) {
  return page.evaluate(
    async ({ currentMode, targetScrollTop, currentStepIndex }) => {
      const measureName = `scenario2-${currentMode}-automation-scroll-to-next-paint-${currentStepIndex}`;
      const startMark = `${measureName}-start`;
      const endMark = `${measureName}-end`;

      const scrollTarget =
        currentMode === "optimized"
          ? document.querySelector('[data-testid="scenario2-scroll-container"]')
          : document.scrollingElement ?? document.documentElement;

      if (!scrollTarget) {
        return null;
      }

      performance.mark(startMark);

      scrollTarget.scrollTop = targetScrollTop;

      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });

      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);

      const entries = performance.getEntriesByName(measureName);
      const lastEntry = entries[entries.length - 1];
      const duration = lastEntry ? Number(lastEntry.duration.toFixed(2)) : null;

      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(measureName);

      return duration;
    },
    {
      currentMode: mode,
      targetScrollTop: scrollTop,
      currentStepIndex: stepIndex,
    },
  );
}

async function countRenderedRows(page, mode) {
  return page.evaluate((currentMode) => {
    if (currentMode === "optimized") {
      return document.querySelectorAll(
        '[data-testid="scenario2-scroll-container"] .virtual-absolute-row',
      ).length;
    }

    return document.querySelectorAll(
      '[data-testid="scenario2-baseline-table"] .virtual-row:not(.virtual-header)',
    ).length;
  }, mode);
}

async function runScenario({ mode, runIndex }) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1440,
      height: 1000,
    },
    args: [
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
    ],
  });

  const page = await browser.newPage();

  const consoleMessages = [];
  const profilerEntries = [];

  page.on("console", (message) => {
    const text = message.text();

    consoleMessages.push({
      type: message.type(),
      text,
      timestamp: Date.now(),
    });

    const profilerEntry = extractProfilerEntryFromConsole(text);

    if (profilerEntry) {
      profilerEntries.push({
        ...profilerEntry,
        timestamp: Date.now(),
      });
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push({
      type: "pageerror",
      text: error.message,
      timestamp: Date.now(),
    });
  });

  const url = `${BASE_URL}/?scenario=${SCENARIO}&mode=${mode}`;
  const scenarioSelector =
    mode === "baseline"
      ? '[data-testid="scenario2-baseline"]'
      : '[data-testid="scenario2-optimized"]';

  const filePrefix = `${SCENARIO}-${mode}-run-${runIndex}`;
  const tracePath = path.join(OUTPUT_DIR, `${filePrefix}-trace.json`);
  const resultPath = path.join(OUTPUT_DIR, `${filePrefix}-result.json`);

  try {
    await page.tracing.start({
      path: tracePath,
      screenshots: false,
      categories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "blink.user_timing",
        "loading",
        "v8",
      ],
    });

    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    await page.waitForSelector(scenarioSelector, {
      timeout: 15000,
    });

    await sleep(AFTER_PAGE_LOAD_WAIT_MS);

    const initialBrowserMetrics = await page.metrics();
    const initialRenderedRows = await countRenderedRows(page, mode);
    const maxScrollTop = await getMaxScrollTop(page, mode);

    const scrollToNextPaintValues = [];
    const renderedRowsDuringScroll = [];

    for (let stepIndex = 1; stepIndex <= SCROLL_STEPS_COUNT; stepIndex += 1) {
      const scrollTop = Math.floor(
        (maxScrollTop * stepIndex) / (SCROLL_STEPS_COUNT + 1),
      );

      const duration = await measureScrollToNextPaint(page, {
        mode,
        scrollTop,
        stepIndex,
      });

      if (duration !== null) {
        scrollToNextPaintValues.push(duration);
      }

      const renderedRows = await countRenderedRows(page, mode);
      renderedRowsDuringScroll.push(renderedRows);

      await sleep(AFTER_SCROLL_WAIT_MS);
    }

    const finalBrowserMetrics = await page.metrics();

    const userTimingMeasures = await page.evaluate(() => {
      return performance.getEntriesByType("measure").map((entry) => ({
        name: entry.name,
        startTime: Number(entry.startTime.toFixed(2)),
        duration: Number(entry.duration.toFixed(2)),
      }));
    });

    await page.tracing.stop();

    const result = {
      scenario: SCENARIO,
      mode,
      runIndex,
      url,
      scrollStepsCount: SCROLL_STEPS_COUNT,
      maxScrollTop,
      initialRenderedRows,
      renderedRowsDuringScroll,
      scrollToNextPaintValues,
      initialBrowserMetrics,
      finalBrowserMetrics,
      profilerEntries,
      userTimingMeasures,
      consoleMessages,
      tracePath,
      collectedAt: new Date().toISOString(),
    };

    await fs.writeFile(resultPath, JSON.stringify(result, null, 2), "utf-8");

    return result;
  } catch (error) {
    try {
      await page.tracing.stop();
    } catch {
    }

    const errorResult = {
      scenario: SCENARIO,
      mode,
      runIndex,
      url,
      error: error instanceof Error ? error.message : String(error),
      consoleMessages,
      tracePath,
      collectedAt: new Date().toISOString(),
    };

    await fs.writeFile(resultPath, JSON.stringify(errorResult, null, 2), "utf-8");

    throw error;
  } finally {
    await browser.close();
  }
}

async function main() {
  await ensureOutputDir();

  const allResults = [];

  for (let runIndex = 1; runIndex <= RUNS_COUNT; runIndex += 1) {
    for (const mode of MODES) {
      console.log(`Running ${SCENARIO} ${mode}, run ${runIndex}`);

      const result = await runScenario({
        mode,
        runIndex,
      });

      allResults.push(result);
    }
  }

  const summary = MODES.map((mode) => {
    const modeResults = allResults.filter((result) => result.mode === mode);

    const scrollToNextPaintValues = modeResults.flatMap(
      (result) => result.scrollToNextPaintValues,
    );

    const initialRenderedRowsValues = modeResults.map(
      (result) => result.initialRenderedRows,
    );

    const renderedRowsDuringScrollValues = modeResults.flatMap(
      (result) => result.renderedRowsDuringScroll,
    );

    const initialDomNodesValues = modeResults.map(
      (result) => result.initialBrowserMetrics.Nodes,
    );

    const mountProfilerDurationValues = modeResults.flatMap((result) =>
      result.profilerEntries
        .filter((entry) => entry.phase === "mount")
        .map((entry) => entry.durationMs),
    );

    return {
      scenario: SCENARIO,
      mode,
      runs: modeResults.length,

      scrollToNextPaintCount: scrollToNextPaintValues.length,
      scrollToNextPaintAverageMs: calculateAverage(scrollToNextPaintValues),
      scrollToNextPaintMedianMs: calculateMedian(scrollToNextPaintValues),
      scrollToNextPaintValues,

      initialRenderedRowsAverage: calculateAverage(initialRenderedRowsValues),
      initialRenderedRowsMedian: calculateMedian(initialRenderedRowsValues),
      initialRenderedRowsValues,

      renderedRowsDuringScrollAverage: calculateAverage(
        renderedRowsDuringScrollValues,
      ),
      renderedRowsDuringScrollMedian: calculateMedian(
        renderedRowsDuringScrollValues,
      ),
      renderedRowsDuringScrollValues,

      initialDomNodesAverage: calculateAverage(initialDomNodesValues),
      initialDomNodesMedian: calculateMedian(initialDomNodesValues),
      initialDomNodesValues,

      mountProfilerDurationAverageMs: calculateAverage(
        mountProfilerDurationValues,
      ),
      mountProfilerDurationMedianMs: calculateMedian(
        mountProfilerDurationValues,
      ),
      mountProfilerDurationValues,
    };
  });

  const summaryPath = path.join(OUTPUT_DIR, `${SCENARIO}-summary.json`);

  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

  console.log("Summary:");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Results saved to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error("Performance run failed:", error);
  process.exitCode = 1;
});