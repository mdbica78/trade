import { DatabaseService } from '../db';
import { SUPPORTED_METRIC_KEYS, type MetricKey } from '../types';

interface MonitoredEtfRow {
  symbol: string;
  enabled: number | string;
}

interface MonitoredEtf {
  symbol: string;
  enabled: boolean;
}

interface MonitoredFieldRow {
  field_name: string;
  display_name: string;
  enabled: number | string;
}

interface MonitoredField {
  fieldName: string;
  displayName: string;
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

export type DashboardMetric = MetricKey;

const DASHBOARD_METRIC_SET = new Set<string>(SUPPORTED_METRIC_KEYS);

function isDashboardMetric(value: string): value is DashboardMetric {
  return DASHBOARD_METRIC_SET.has(value);
}

export class ConfigService {
  async getAllMonitoredEtfs(): Promise<MonitoredEtf[]> {
    const database = new DatabaseService().getDatabase();
    const rows = (await database(
      `
      SELECT
          symbol,
          enabled
      FROM monitored_etfs
      ORDER BY symbol
      `,
    )) as MonitoredEtfRow[];

    return rows.map((row) => ({
      symbol: row.symbol,
      enabled: Number(row.enabled) === 1,
    }));
  }

  async getMonitoredEtfs(): Promise<string[]> {
    const database = new DatabaseService().getDatabase();
    const rows = (await database(
      `
      SELECT symbol
      FROM monitored_etfs
      WHERE enabled = 1
      ORDER BY symbol
      `,
    )) as Array<{ symbol: string }>;

    return rows.map((row) => row.symbol);
  }

  async getEnabledMonitoredEtfCount(): Promise<number> {
    const database = new DatabaseService().getDatabase();
    const rows = (await database(
      `
      SELECT COUNT(*) AS count
      FROM monitored_etfs
      WHERE enabled = 1
      `,
    )) as Array<{ count: number | string }>;

    return Number(rows[0]?.count ?? 0);
  }

  async enableEtf(symbol: string): Promise<void> {
    const database = new DatabaseService().getDatabase();
    await database(
      `
      UPDATE monitored_etfs
      SET enabled = 1
      WHERE symbol = $1
      `,
      [symbol],
    );
  }

  async disableEtf(symbol: string): Promise<void> {
    const database = new DatabaseService().getDatabase();
    await database(
      `
      UPDATE monitored_etfs
      SET enabled = 0
      WHERE symbol = $1
      `,
      [symbol],
    );
  }

  async getAllMonitoredFields(): Promise<MonitoredField[]> {
    const database = new DatabaseService().getDatabase();
    const rows = (await database(
      `
      SELECT
          field_name,
          display_name,
          enabled
      FROM monitored_fields
      ORDER BY field_name
      `,
    )) as MonitoredFieldRow[];

    return rows.map((row) => ({
      fieldName: row.field_name,
      displayName: row.display_name,
      enabled: Number(row.enabled) === 1,
    }));
  }

  async getEnabledFieldNames(): Promise<string[]> {
    const database = new DatabaseService().getDatabase();
    const rows = (await database(
      `
      SELECT field_name
      FROM monitored_fields
      WHERE enabled = 1
      ORDER BY field_name
      `,
    )) as Array<{ field_name: string }>;

    return rows.map((row) => row.field_name);
  }

  async enableField(fieldName: string): Promise<void> {
    const database = new DatabaseService().getDatabase();
    await database(
      `
      UPDATE monitored_fields
      SET enabled = 1
      WHERE field_name = $1
      `,
      [fieldName],
    );
  }

  async disableField(fieldName: string): Promise<void> {
    const database = new DatabaseService().getDatabase();
    await database(
      `
      UPDATE monitored_fields
      SET enabled = 0
      WHERE field_name = $1
      `,
      [fieldName],
    );
  }

  async getSchedulerSettings(): Promise<SchedulerSettings> {
    const database = new DatabaseService().getDatabase();
    const rows = (await database(
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
    const database = new DatabaseService().getDatabase();
    const rows = (await database(
      `
      SELECT value
      FROM configuration
      WHERE key = $1
      LIMIT 1
      `,
      ['dashboard_metric'],
    )) as Array<{ value: string }>;

    const metric = rows[0]?.value;
    if (metric && isDashboardMetric(metric)) {
      return metric;
    }

    return 'units_in_circulation';
  }

  async saveDashboardMetric(metric: DashboardMetric): Promise<void> {
    const database = new DatabaseService().getDatabase();
    await database(
      `
      INSERT INTO configuration (key, value)
      VALUES ($1, $2)
      ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
      `,
      ['dashboard_metric', metric],
    );
  }

  async saveSchedulerSettings(settings: SchedulerSettings): Promise<void> {
    const database = new DatabaseService().getDatabase();
    await database(
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
}
