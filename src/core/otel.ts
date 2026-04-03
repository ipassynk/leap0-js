import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

import type { Leap0ConfigResolved } from "@/models/config.js";
import { SDK_VERSION } from "@/core/version.js";

const TRACER_NAME = "leap0-js-sdk";
let tracerProviderInstance: NodeTracerProvider | undefined;
let meterProviderInstance: MeterProvider | undefined;

/**
 * Returns the shared OpenTelemetry tracer for the SDK.
 *
 * Returns:
 *   The tracer used for SDK spans.
 */
export function getTracer() {
  return trace.getTracer(TRACER_NAME, SDK_VERSION);
}

/**
 * Initializes process-wide OpenTelemetry tracer and meter providers when missing.
 *
 */
export function initOtel(): void {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: TRACER_NAME,
    [ATTR_SERVICE_VERSION]: SDK_VERSION,
  });

  if (!tracerProviderInstance) {
    tracerProviderInstance = new NodeTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
    });
    trace.setGlobalTracerProvider(tracerProviderInstance);
  }

  if (!meterProviderInstance) {
    const metricReader = new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() });
    meterProviderInstance = new MeterProvider({ resource, readers: [metricReader] });
    metrics.setGlobalMeterProvider(meterProviderInstance);
  }
}

/**
 * Shuts down OpenTelemetry providers and resets state so they can be re-initialized.
 *
 * Returns:
 *   A promise that resolves once providers are flushed and shut down.
 */
export async function shutdownOtel(): Promise<void> {
  const tracerProvider = tracerProviderInstance;
  const meterProvider = meterProviderInstance;
  tracerProviderInstance = undefined;
  meterProviderInstance = undefined;

  await Promise.all([
    tracerProvider?.shutdown().catch((error) => {
      console.warn("Failed to shutdown OpenTelemetry tracer provider", error);
    }),
    meterProvider?.shutdown().catch((error) => {
      console.warn("Failed to shutdown OpenTelemetry meter provider", error);
    }),
  ]);
}

/**
 * Executes an operation inside an OpenTelemetry span when SDK telemetry is enabled.
 *
 * Args:
 *   config: Resolved SDK configuration.
 *   name: Span name.
 *   attributes: Span attributes.
 *   fn: Operation to execute.
 *
 * Returns:
 *   The operation result.
 */
export async function withSpan<T>(
  config: Leap0ConfigResolved,
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  if (!config.sdkOtelEnabled) {
    return fn();
  }

  return getTracer().startActiveSpan(name, async (span) => {
    span.setAttributes(attributes);
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}
