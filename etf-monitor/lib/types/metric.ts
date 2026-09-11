export const SUPPORTED_METRIC_KEYS = ['units_in_circulation', 'vuan', 'net_assets'] as const;

export type MetricKey = (typeof SUPPORTED_METRIC_KEYS)[number];

export type MetricValueMap = Record<MetricKey, number | null>;
