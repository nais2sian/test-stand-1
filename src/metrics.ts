import { onCLS, onINP, onLCP, type CLSMetric, type INPMetric, type LCPMetric } from "web-vitals";

export function initWebVitals(): void {
  onINP((metric: INPMetric) => {
    console.log("[Web Vitals] INP:", metric.value, metric);
  });

  onLCP((metric: LCPMetric) => {
    console.log("[Web Vitals] LCP:", metric.value, metric);
  });

  onCLS((metric: CLSMetric) => {
    console.log("[Web Vitals] CLS:", metric.value, metric);
  });
}
