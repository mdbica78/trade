import type { BVBService } from '../bvb';
import { DatabaseService } from '../db';
import type { PDFService } from '../pdf';

interface MonitoredEtfRow {
  symbol: string;
  name: string | null;
  isin: string | null;
  bvb_symbol: string | null;
  enabled: number | string;
}

export interface MonitoredEtf {
  symbol: string;
  name: string | null;
  isin: string | null;
  bvbSymbol: string;
  enabled: boolean;
}

interface MonitoredFieldRow {
  field_name: string;
  display_name: string;
  extractor_key: string | null;
  extraction_hint: string | null;
  extraction_pattern: string | null;
  enabled: number | string;
}

export type MetricExtractorKey = 'units_in_circulation' | 'vuan' | 'net_assets' | 'regex_label_number';

const EXTRACTOR_KEYS = new Set<MetricExtractorKey>([
  'units_in_circulation',
  'vuan',
  'net_assets',
  'regex_label_number',
]);

export interface MonitoredField {
  fieldName: string;
  displayName: string;
  extractorKey: MetricExtractorKey;
  extractionHint: string | null;
  extractionPattern: string | null;
  enabled: boolean;
}

interface ConfigurationRow {
  key: string;
  value: string;
}

export interface SchedulerSettings {
  enabled: boolean;
  time: string;
}

export type DashboardMetric = string;

export interface ConfigurationSnapshot {
  etfs: MonitoredEtf[];
  fields: MonitoredField[];
  dashboardMetric: DashboardMetric;
  scheduler: SchedulerSettings;
}

export interface ValidatedEtfResult {
  symbol: string;
  name: string;
  isin: string;
  bvbSymbol: string;
  latestReportDate: string;
  latestReportUrl: string;
}

export interface MetricValidationResult {
  field: MonitoredField;
  alreadyExists: boolean;
  alreadyEnabled: boolean;
  sampleValue: number;
  sourceSymbol: string;
  latestReportDate: string;
  latestReportUrl: string;
}

export interface AddMonitoredMetricInput {
  fieldName: string;
  displayName: string;
  extractorKey: MetricExtractorKey;
  extractionHint?: string | null;
  extractionPattern?: string | null;
  enabled?: boolean;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{2,20}$/.test(symbol);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slugifyMetricName(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  if (normalized.length === 0) {
    return 'metric_value';
  }

  if (/^[0-9]/.test(normalized)) {
    return `metric_${normalized}`;
  }

  return normalized;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseLocalizedNumber(rawValue: string): number {
  const compact = rawValue.replace(/\u00A0/g, ' ').replace(/\s+/g, '').trim();
  if (!compact) {
    throw new Error('Failed to parse numeric value');
  }

  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;
  let normalized = compact;

  if (commaCount > 0 && dotCount > 0) {
    if (compact.lastIndexOf(',') > compact.lastIndexOf('.')) {
      normalized = compact.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = compact.replace(/,/g, '');
    }
  } else if (commaCount > 0) {
    if (commaCount > 1) {
      const parts = compact.split(',');
      const usesThousandsGrouping = parts.slice(1).every((part) => part.length === 3);
      normalized = usesThousandsGrouping ? parts.join('') : compact.replace(/,/g, '');
    } else {
      const [integerPart, fractionalPart = ''] = compact.split(',');
      if (fractionalPart.length === 3) {
        normalized = `${integerPart}${fractionalPart}`;
      } else {
        normalized = compact.replace(',', '.');
      }
    }
  } else if (dotCount > 0) {
    if (dotCount > 1) {
      const parts = compact.split('.');
      const usesThousandsGrouping = parts.slice(1).every((part) => part.length === 3);
      if (usesThousandsGrouping) {
        normalized = parts.join('');
      } else {
        const lastDotIndex = compact.lastIndexOf('.');
        normalized =
          compact.slice(0, lastDotIndex).replace(/\./g, '') + compact.slice(lastDotIndex);
      }
    } else {
      const [integerPart, fractionalPart = ''] = compact.split('.');
      if (fractionalPart.length === 3) {
        normalized = `${integerPart}${fractionalPart}`;
      }
    }
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error('Failed to parse numeric value');
  }

  return value;
}

function normalizeKeyText(value: string): string {
  return normalizeText(value.replace(/_/g, ' '));
}

function findConfirmedSourceLabel(
  reportText: string,
  requestedMetric: string,
): { sourceLabel: string; parsedValue: number } | null {
  const normalizedQuery = normalizeText(requestedMetric);
  const lookaheadLines = 2;
  const lines = reportText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!normalizeText(line).includes(normalizedQuery)) {
      continue;
    }

    const sameLineMatch = line.match(/([+-]?[0-9][0-9.,\s\u00A0]*)/);
    if (sameLineMatch && typeof sameLineMatch.index === 'number' && sameLineMatch.index > 0) {
      const sourceLabel = line.slice(0, sameLineMatch.index).trim();
      if (!sourceLabel) {
        continue;
      }

      try {
        const parsedValue = parseLocalizedNumber(sameLineMatch[1]);
        return { sourceLabel, parsedValue };
      } catch {
        continue;
      }
    }

    const sourceLabel = line;
    for (
      let offset = 1;
      offset <= lookaheadLines && lineIndex + offset < lines.length;
      offset += 1
    ) {
      const nearbyLine = lines[lineIndex + offset];
      const nearbyMatch = nearbyLine.match(/([+-]?[0-9][0-9.,\s\u00A0]*)/);
      if (!nearbyMatch) {
        continue;
      }

      const remainder = nearbyLine.replace(nearbyMatch[1], '').trim();
      if (/[A-Za-z\u00C0-\u024F]/.test(remainder)) {
        continue;
      }

      try {
        const parsedValue = parseLocalizedNumber(nearbyMatch[1]);
        return { sourceLabel, parsedValue };
      } catch {
        continue;
      }
    }
  }

  return null;
}

function toExtractorKey(value: string | null): MetricExtractorKey {
  if (value && EXTRACTOR_KEYS.has(value as MetricExtractorKey)) {
    return value as MetricExtractorKey;
  }

  return 'regex_label_number';
}

function getBuiltinMetricDefinition(requestedMetric: string): AddMonitoredMetricInput | null {
  const normalized = normalizeText(requestedMetric);

  if (
    normalized.includes('units in circulation') ||
    normalized.includes('numar u.f') ||
    normalized.includes('unitati in circulatie') ||
    normalized === 'units'
  ) {
    return {
      fieldName: 'units_in_circulation',
      displayName: 'Units in Circulation',
      extractorKey: 'units_in_circulation',
    };
  }

  if (normalized.includes('vuan') || normalized.includes('valoare unitara')) {
    return {
      fieldName: 'vuan',
      displayName: 'VUAN',
      extractorKey: 'vuan',
    };
  }

  if (
    normalized.includes('net assets') ||
    normalized.includes('fund size') ||
    normalized.includes('active net') ||
    normalized.includes('activ net')
  ) {
    return {
      fieldName: 'net_assets',
      displayName: 'Net Assets',
      extractorKey: 'net_assets',
    };
  }

  return null;
}

export class ConfigService {
  private readonly database = new DatabaseService().getDatabase();

  async getAllMonitoredEtfs(): Promise<MonitoredEtf[]> {
    const rows = (await this.database(
      `
      SELECT
          symbol,
          name,
          isin,
          bvb_symbol,
          enabled
      FROM monitored_etfs
      ORDER BY symbol
      `,
    )) as MonitoredEtfRow[];

    return rows.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      isin: row.isin,
      bvbSymbol: row.bvb_symbol ?? row.symbol,
      enabled: Number(row.enabled) === 1,
    }));
  }

  async getMonitoredEtf(symbol: string): Promise<MonitoredEtf | null> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const rows = (await this.database(
      `
      SELECT
          symbol,
          name,
          isin,
          bvb_symbol,
          enabled
      FROM monitored_etfs
      WHERE symbol = $1
      LIMIT 1
      `,
      [normalizedSymbol],
    )) as MonitoredEtfRow[];

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      symbol: row.symbol,
      name: row.name,
      isin: row.isin,
      bvbSymbol: row.bvb_symbol ?? row.symbol,
      enabled: Number(row.enabled) === 1,
    };
  }

  async getMonitoredEtfs(): Promise<string[]> {
    const etfs = await this.getEnabledMonitoredEtfs();
    return etfs.map((etf) => etf.bvbSymbol);
  }

  async getEnabledMonitoredEtfs(): Promise<MonitoredEtf[]> {
    const rows = (await this.database(
      `
      SELECT
          symbol,
          name,
          isin,
          bvb_symbol,
          enabled
      FROM monitored_etfs
      WHERE enabled = 1
      ORDER BY symbol
      `,
    )) as MonitoredEtfRow[];

    return rows.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      isin: row.isin,
      bvbSymbol: row.bvb_symbol ?? row.symbol,
      enabled: true,
    }));
  }

  async getEnabledMonitoredEtfCount(): Promise<number> {
    const rows = (await this.database(
      `
      SELECT COUNT(*) AS count
      FROM monitored_etfs
      WHERE enabled = 1
      `,
    )) as Array<{ count: number | string }>;

    return Number(rows[0]?.count ?? 0);
  }

  async addMonitoredEtf(etf: MonitoredEtf): Promise<void> {
    const symbol = normalizeSymbol(etf.symbol);
    if (!isValidSymbol(symbol)) {
      throw new Error('Invalid ETF symbol');
    }

    const bvbSymbol = normalizeSymbol(etf.bvbSymbol);
    if (!isValidSymbol(bvbSymbol)) {
      throw new Error('Invalid ETF BVB symbol');
    }

    await this.database(
      `
      INSERT INTO monitored_etfs (symbol, name, isin, bvb_symbol, enabled)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(symbol) DO UPDATE SET
        name = EXCLUDED.name,
        isin = EXCLUDED.isin,
        bvb_symbol = EXCLUDED.bvb_symbol,
        enabled = EXCLUDED.enabled
      `,
      [symbol, etf.name, etf.isin, bvbSymbol, etf.enabled ? 1 : 0],
    );
  }

  async enableEtf(symbol: string): Promise<void> {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!isValidSymbol(normalizedSymbol)) {
      throw new Error('Invalid ETF symbol');
    }

    await this.database(
      `
      UPDATE monitored_etfs
      SET enabled = 1
      WHERE symbol = $1
      `,
      [normalizedSymbol],
    );
  }

  async disableEtf(symbol: string): Promise<void> {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!isValidSymbol(normalizedSymbol)) {
      throw new Error('Invalid ETF symbol');
    }

    await this.database(
      `
      UPDATE monitored_etfs
      SET enabled = 0
      WHERE symbol = $1
      `,
      [normalizedSymbol],
    );
  }

  async removeMonitoredEtf(symbol: string): Promise<void> {
    await this.disableEtf(symbol);
  }

  async validateEtf(candidate: string, bvbService: BVBService): Promise<ValidatedEtfResult> {
    const query = candidate.trim();
    if (!query) {
      throw new Error('ETF identifier is required');
    }

    const allEtfs = await bvbService.getEtfs();
    const normalizedCandidate = normalizeText(query);
    const normalizedSymbolCandidate = normalizeSymbol(query);

    const exactSymbol = allEtfs.find((etf) => etf.symbol === normalizedSymbolCandidate);
    const exactIsin = allEtfs.find((etf) => normalizeText(etf.isin) === normalizedCandidate);
    const exactName = allEtfs.find((etf) => normalizeText(etf.name) === normalizedCandidate);
    const partialMatch = allEtfs.find((etf) => normalizeText(etf.name).includes(normalizedCandidate));
    const matched = exactSymbol ?? exactIsin ?? exactName ?? partialMatch;

    if (!matched) {
      throw new Error('ETF not found on BVB');
    }

    const latestReport = await bvbService.getLatestReport(matched.symbol);
    if (!latestReport) {
      throw new Error(`No daily report found for ETF ${matched.symbol}`);
    }

    return {
      symbol: matched.symbol,
      name: matched.name,
      isin: matched.isin,
      bvbSymbol: matched.symbol,
      latestReportDate: latestReport.reportDate.toISOString(),
      latestReportUrl: latestReport.reportUrl,
    };
  }

  async getAllMonitoredFields(): Promise<MonitoredField[]> {
    const rows = (await this.database(
      `
      SELECT
          field_name,
          display_name,
          extractor_key,
          extraction_hint,
          extraction_pattern,
          enabled
      FROM monitored_fields
      ORDER BY field_name
      `,
    )) as MonitoredFieldRow[];

    return rows.map((row) => ({
      fieldName: row.field_name,
      displayName: row.display_name,
      extractorKey: toExtractorKey(row.extractor_key),
      extractionHint: row.extraction_hint,
      extractionPattern: row.extraction_pattern,
      enabled: Number(row.enabled) === 1,
    }));
  }

  async getEnabledMonitoredFields(): Promise<MonitoredField[]> {
    const rows = (await this.database(
      `
      SELECT
          field_name,
          display_name,
          extractor_key,
          extraction_hint,
          extraction_pattern,
          enabled
      FROM monitored_fields
      WHERE enabled = 1
      ORDER BY field_name
      `,
    )) as MonitoredFieldRow[];

    return rows.map((row) => ({
      fieldName: row.field_name,
      displayName: row.display_name,
      extractorKey: toExtractorKey(row.extractor_key),
      extractionHint: row.extraction_hint,
      extractionPattern: row.extraction_pattern,
      enabled: true,
    }));
  }

  async getEnabledFieldNames(): Promise<string[]> {
    const rows = (await this.database(
      `
      SELECT field_name
      FROM monitored_fields
      WHERE enabled = 1
      ORDER BY field_name
      `,
    )) as Array<{ field_name: string }>;

    return rows.map((row) => row.field_name);
  }

  async getMonitoredField(fieldName: string): Promise<MonitoredField | null> {
    const rows = (await this.database(
      `
      SELECT
          field_name,
          display_name,
          extractor_key,
          extraction_hint,
          extraction_pattern,
          enabled
      FROM monitored_fields
      WHERE field_name = $1
      LIMIT 1
      `,
      [fieldName],
    )) as MonitoredFieldRow[];

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      fieldName: row.field_name,
      displayName: row.display_name,
      extractorKey: toExtractorKey(row.extractor_key),
      extractionHint: row.extraction_hint,
      extractionPattern: row.extraction_pattern,
      enabled: Number(row.enabled) === 1,
    };
  }

  async addMonitoredMetric(metric: AddMonitoredMetricInput): Promise<void> {
    if (!metric.fieldName.trim()) {
      throw new Error('Metric key is required');
    }
    if (!metric.displayName.trim()) {
      throw new Error('Metric display name is required');
    }
    if (!EXTRACTOR_KEYS.has(metric.extractorKey)) {
      throw new Error('Invalid metric extractor');
    }

    await this.database(
      `
      INSERT INTO monitored_fields (
        field_name,
        display_name,
        extractor_key,
        extraction_hint,
        extraction_pattern,
        enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(field_name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        extractor_key = EXCLUDED.extractor_key,
        extraction_hint = EXCLUDED.extraction_hint,
        extraction_pattern = EXCLUDED.extraction_pattern,
        enabled = EXCLUDED.enabled
      `,
      [
        metric.fieldName,
        metric.displayName,
        metric.extractorKey,
        metric.extractionHint ?? null,
        metric.extractionPattern ?? null,
        metric.enabled === false ? 0 : 1,
      ],
    );
  }

  async enableField(fieldName: string): Promise<void> {
    await this.database(
      `
      UPDATE monitored_fields
      SET enabled = 1
      WHERE field_name = $1
      `,
      [fieldName],
    );
  }

  async disableField(fieldName: string): Promise<void> {
    await this.database(
      `
      UPDATE monitored_fields
      SET enabled = 0
      WHERE field_name = $1
      `,
      [fieldName],
    );
  }

  async removeMonitoredMetric(fieldName: string): Promise<void> {
    await this.disableField(fieldName);
  }

  async validateMetric(
    requestedMetric: string,
    bvbService: BVBService,
    pdfService: PDFService,
    preferredSourceSymbol?: string,
  ): Promise<MetricValidationResult> {
    const query = requestedMetric.trim();
    if (!query) {
      throw new Error('Metric name is required');
    }

    const allFields = await this.getAllMonitoredFields();
    const normalizedQuery = normalizeText(query);
    const existing = allFields.find((field) => {
      const normalizedKey = normalizeKeyText(field.fieldName);
      const normalizedDisplayName = normalizeText(field.displayName);
      return normalizedDisplayName === normalizedQuery || normalizedKey === normalizedQuery;
    });

    if (existing) {
      const sample = await this.extractSampleMetricValue(
        existing,
        bvbService,
        pdfService,
        preferredSourceSymbol,
      );
      return {
        field: existing,
        alreadyExists: true,
        alreadyEnabled: existing.enabled,
        sampleValue: sample.value,
        sourceSymbol: sample.symbol,
        latestReportDate: sample.reportDate,
        latestReportUrl: sample.reportUrl,
      };
    }

    const builtinDefinition = getBuiltinMetricDefinition(query);
    if (builtinDefinition) {
      const canonicalExisting = allFields.find(
        (field) =>
          field.fieldName === builtinDefinition.fieldName ||
          field.extractorKey === builtinDefinition.extractorKey,
      );
      const field: MonitoredField = canonicalExisting ?? {
        fieldName: builtinDefinition.fieldName,
        displayName: builtinDefinition.displayName,
        extractorKey: builtinDefinition.extractorKey,
        extractionHint: builtinDefinition.extractionHint ?? null,
        extractionPattern: builtinDefinition.extractionPattern ?? null,
        enabled: true,
      };
      const sample = await this.extractSampleMetricValue(
        field,
        bvbService,
        pdfService,
        preferredSourceSymbol,
      );
      return {
        field,
        alreadyExists: Boolean(canonicalExisting),
        alreadyEnabled: canonicalExisting?.enabled ?? false,
        sampleValue: sample.value,
        sourceSymbol: sample.symbol,
        latestReportDate: sample.reportDate,
        latestReportUrl: sample.reportUrl,
      };
    }

    const sampleSource = await this.getMetricValidationSource(
      bvbService,
      pdfService,
      preferredSourceSymbol,
    );
    const confirmedSource = findConfirmedSourceLabel(sampleSource.reportText, query);
    if (!confirmedSource) {
      throw new Error(
        'Requested metric could not be confirmed from the ETF report source field. Add a known metric or provide the exact source label from the report.',
      );
    }

    const fieldName = await this.nextAvailableFieldName(slugifyMetricName(query));
    const provisionalField: MonitoredField = {
      fieldName,
      displayName: query.trim(),
      extractorKey: 'regex_label_number',
      extractionHint: confirmedSource.sourceLabel,
      extractionPattern:
        `${escapeRegExp(confirmedSource.sourceLabel)}[^0-9+-]*([+-]?[0-9][0-9.,\\s\\u00A0]*)`,
      enabled: true,
    };
    const sample = await this.extractSampleMetricValue(
      provisionalField,
      bvbService,
      pdfService,
      sampleSource.symbol,
      sampleSource.reportText,
      sampleSource.reportDate,
      sampleSource.reportUrl,
    );

    return {
      field: provisionalField,
      alreadyExists: false,
      alreadyEnabled: false,
      sampleValue: sample.value,
      sourceSymbol: sample.symbol,
      latestReportDate: sample.reportDate,
      latestReportUrl: sample.reportUrl,
    };
  }

  async getSchedulerSettings(): Promise<SchedulerSettings> {
    const rows = (await this.database(
      `
      SELECT key, value
      FROM configuration
      WHERE key IN ($1, $2)
      `,
      ['scheduler_enabled', 'scheduler_time'],
    )) as ConfigurationRow[];
    const values = new Map(rows.map((row) => [row.key, row.value]));

    return {
      enabled: values.get('scheduler_enabled') !== 'false',
      time: values.get('scheduler_time') ?? '09:00',
    };
  }

  async getDashboardMetric(): Promise<DashboardMetric> {
    const rows = (await this.database(
      `
      SELECT value
      FROM configuration
      WHERE key = $1
      LIMIT 1
      `,
      ['dashboard_metric'],
    )) as Array<{ value: string }>;
    const configuredMetric = rows[0]?.value;
    if (configuredMetric) {
      const configuredField = await this.getMonitoredField(configuredMetric);
      if (configuredField?.enabled) {
        return configuredMetric;
      }
    }

    const fallbackField = await this.getMonitoredField('units_in_circulation');
    if (fallbackField?.enabled) {
      return fallbackField.fieldName;
    }

    const firstField = (await this.getEnabledMonitoredFields())[0];
    return firstField?.fieldName ?? 'units_in_circulation';
  }

  async setDashboardMetric(metric: DashboardMetric): Promise<void> {
    const monitoredField = await this.getMonitoredField(metric);
    if (!monitoredField || !monitoredField.enabled) {
      throw new Error('Unknown dashboard metric');
    }

    await this.database(
      `
      INSERT INTO configuration (key, value)
      VALUES ($1, $2)
      ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
      `,
      ['dashboard_metric', metric],
    );
  }

  async saveDashboardMetric(metric: DashboardMetric): Promise<void> {
    await this.setDashboardMetric(metric);
  }

  async saveSchedulerSettings(settings: SchedulerSettings): Promise<void> {
    await this.database(
      `
      INSERT INTO configuration (key, value)
      VALUES
        ($1, $2),
        ($3, $4)
      ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
      `,
      ['scheduler_enabled', settings.enabled ? 'true' : 'false', 'scheduler_time', settings.time],
    );
  }

  async getConfiguration(): Promise<ConfigurationSnapshot> {
    const [etfs, fields, dashboardMetric, scheduler] = await Promise.all([
      this.getAllMonitoredEtfs(),
      this.getAllMonitoredFields(),
      this.getDashboardMetric(),
      this.getSchedulerSettings(),
    ]);

    return {
      etfs,
      fields,
      dashboardMetric,
      scheduler,
    };
  }

  private async nextAvailableFieldName(baseFieldName: string): Promise<string> {
    const existingNames = new Set((await this.getAllMonitoredFields()).map((field) => field.fieldName));
    if (!existingNames.has(baseFieldName)) {
      return baseFieldName;
    }

    let suffix = 2;
    while (existingNames.has(`${baseFieldName}_${suffix}`)) {
      suffix += 1;
    }

    return `${baseFieldName}_${suffix}`;
  }

  private async extractSampleMetricValue(
    field: MonitoredField,
    bvbService: BVBService,
    pdfService: PDFService,
    preferredSourceSymbol?: string,
    existingReportText?: string,
    existingReportDate?: string,
    existingReportUrl?: string,
  ): Promise<{ symbol: string; value: number; reportDate: string; reportUrl: string }> {
    if (existingReportText && existingReportDate && existingReportUrl && preferredSourceSymbol) {
      const sampleValue = pdfService.extractMetricValue(existingReportText, field);
      if (!Number.isFinite(sampleValue)) {
        throw new Error(`Metric ${field.fieldName} produced a non-finite value`);
      }

      return {
        symbol: preferredSourceSymbol,
        value: sampleValue,
        reportDate: existingReportDate,
        reportUrl: existingReportUrl,
      };
    }

    const sampleSource = await this.getMetricValidationSource(
      bvbService,
      pdfService,
      preferredSourceSymbol,
    );
    const sampleValue = pdfService.extractMetricValue(sampleSource.reportText, field);
    if (!Number.isFinite(sampleValue)) {
      throw new Error(`Metric ${field.fieldName} produced a non-finite value`);
    }

    return {
      symbol: sampleSource.symbol,
      value: sampleValue,
      reportDate: sampleSource.reportDate,
      reportUrl: sampleSource.reportUrl,
    };
  }

  private async getMetricValidationSource(
    bvbService: BVBService,
    pdfService: PDFService,
    preferredSourceSymbol?: string,
  ): Promise<{ symbol: string; reportText: string; reportDate: string; reportUrl: string }> {
    let sourceSymbol = preferredSourceSymbol?.trim().toUpperCase() ?? '';
    if (sourceSymbol && !isValidSymbol(sourceSymbol)) {
      throw new Error('Invalid metric source ETF symbol');
    }

    if (!sourceSymbol) {
      const monitoredSymbols = await this.getMonitoredEtfs();
      sourceSymbol = monitoredSymbols[0] ?? '';
    }

    if (!sourceSymbol) {
      const bvbEtfs = await bvbService.getEtfs();
      sourceSymbol = bvbEtfs[0]?.symbol ?? '';
    }

    if (!sourceSymbol) {
      throw new Error('No ETF available for metric validation');
    }

    const report = await bvbService.getLatestReport(sourceSymbol);
    if (!report) {
      throw new Error(`No latest report available for ETF ${sourceSymbol}`);
    }
    const reportBuffer = await bvbService.downloadReport(report);
    const parsedText = await pdfService.parse(reportBuffer);

    return {
      symbol: sourceSymbol,
      reportDate: report.reportDate.toISOString(),
      reportUrl: report.reportUrl,
      reportText: parsedText,
    };
  }
}
