export const SUPPORTED_METRIC_KEYS = ['units_in_circulation', 'vuan', 'net_assets'] as const;

export type BuiltInMetricKey = (typeof SUPPORTED_METRIC_KEYS)[number];

export type MetricKey = BuiltInMetricKey;

export type MetricValueMap = Record<MetricKey, number | null>;

export type DynamicMetricValueMap = Record<string, number | null>;
