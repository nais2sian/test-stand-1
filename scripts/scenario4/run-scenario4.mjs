import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const BASE_URL = "http://localhost:4173";
const OUTPUT_DIR = path.join("performance-results", "scenario4");

const SCENARIO = "scenario4";
const MODES = ["baseline", "optimized"];
const RUNS_COUNT = 10;
const INPUT_TEXT = "reactreact";
const TYPE_DELAY_MS = 300;
const AFTER_TYPING_WAIT_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function extractMeasureFromConsole(text) {
  const match = text.match(/\[measure\]\s+(.+?):\s+([\d.]+)\s+ms/);

  if (!match) {
    return null;
  }

  return {
    name: match[1],
    durationMs: Number(match[2]),
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
  const customMeasures = [];

  page.on("console", (message) => {
    const text = message.text();

    consoleMessages.push({
      type: message.type(),
      text,
      timestamp: Date.now(),
    });

    const measure = extractMeasureFromConsole(text);

    if (measure) {
      customMeasures.push({
        ...measure,
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
      ? '[data-testid="scenario4-baseline"]'
      : '[data-testid="scenario4-optimized"]';

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

    await page.waitForSelector('[data-testid="scenario4-input"]', {
      timeout: 15000,
    });

    await page.click('[data-testid="scenario4-input"]');

    await page.keyboard.type(INPUT_TEXT, {
      delay: TYPE_DELAY_MS,
    });

    await sleep(AFTER_TYPING_WAIT_MS);

    const browserMetrics = await page.metrics();

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
      inputText: INPUT_TEXT,
      typeDelayMs: TYPE_DELAY_MS,
      afterTypingWaitMs: AFTER_TYPING_WAIT_MS,
      customMeasures,
      userTimingMeasures,
      browserMetrics,
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
      // Tracing can already be stopped if navigation failed early.
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

    const inputToNextPaintValues = modeResults.flatMap((result) =>
      result.customMeasures
        .filter((measure) => measure.name.includes("input-to-next-paint"))
        .map((measure) => measure.durationMs),
    );

    return {
      scenario: SCENARIO,
      mode,
      runs: modeResults.length,
      inputToNextPaintCount: inputToNextPaintValues.length,
      inputToNextPaintAverageMs: calculateAverage(inputToNextPaintValues),
      inputToNextPaintMedianMs: calculateMedian(inputToNextPaintValues),
      inputToNextPaintValues,
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