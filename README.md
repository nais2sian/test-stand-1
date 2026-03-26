# React Rendering Experiment - Scenario 1 (Memoization)

This project is a small experimental test stand for evaluating how memoization affects React rendering performance and UI responsiveness.

It focuses on a common React performance issue: expensive derived computations executed during render on every update, including updates unrelated to the computation itself.

## Goal

The goal of the experiment is to compare a baseline and an optimized implementation and measure how memoization affects:

- React render cost
- main thread load
- perceived responsiveness

## Scenario

The application simulates a data-heavy UI with:

- a list of 10,000 items
- a search input
- filtering and sorting logic

Two versions are implemented.

### Baseline

- filtering and sorting run on every render
- unrelated state updates also trigger recomputation
- child rows are not memoized

### Optimized

- filtering and sorting are memoized with `useMemo`
- recomputation happens only when the query changes
- row components are wrapped with `React.memo`
- the input handler is stabilized with `useCallback`

## What this experiment shows

This scenario helps demonstrate:

- unnecessary recomputations in React
- the effect of manual memoization
- changes in render duration
- changes in scripting time on the main thread
- changes in responsiveness, especially INP

The scenario is designed as a compute-heavy case, where the main bottleneck is JavaScript work rather than browser layout or paint.

## Metrics

User metrics:

- INP
- LCP
- CLS

Technical metrics:

- React render duration
- commit count and duration
- main thread activity
- long tasks
- custom timings via Performance API

## Run

Development mode:

```bash
npm run dev