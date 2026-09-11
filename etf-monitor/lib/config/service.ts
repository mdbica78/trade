import { DatabaseService } from '../db';
import { SUPPORTED_METRIC_KEYS, type MetricKey } from '../types';

interface MonitoredEtfRow {
  symbol: string;
  enabled: number;
}

interface MonitoredEtf {
  symbol: string;
  enabled: boolean;
}

interface MonitoredFieldRow {
  field_name: string;
  display_name: string;
  enabled: number;
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
  getAllMonitoredEtfs(): MonitoredEtf[] {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      SELECT
          symbol,
          enabled
      FROM monitored_etfs
      ORDER BY rowid
    `);
    const rows = statement.all() as MonitoredEtfRow[];

    return rows.map((row) => ({
      symbol: row.symbol,
      enabled: row.enabled === 1,
    }));
  }

  getMonitoredEtfs(): string[] {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      SELECT symbol
      FROM monitored_etfs
      WHERE enabled = 1
      ORDER BY rowid
    `);
    const rows = statement.all() as Array<{ symbol: string }>;
    return rows.map((row) => row.symbol);
  }

  getEnabledMonitoredEtfCount(): number {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      SELECT COUNT(*) AS count
      FROM monitored_etfs
      WHERE enabled = 1
    `);
    const row = statement.get() as { count: number };
    return row.count;
  }

  enableEtf(symbol: string): void {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      UPDATE monitored_etfs
      SET enabled = 1
      WHERE symbol = ?
    `);
    statement.run(symbol);
  }

  disableEtf(symbol: string): void {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      UPDATE monitored_etfs
      SET enabled = 0
      WHERE symbol = ?
    `);
    statement.run(symbol);
  }

  getAllMonitoredFields(): MonitoredField[] {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      SELECT
          field_name,
          display_name,
          enabled
      FROM monitored_fields
      ORDER BY field_name
    `);
    const rows = statement.all() as MonitoredFieldRow[];

    return rows.map((row) => ({
      fieldName: row.field_name,
      displayName: row.display_name,
      enabled: row.enabled === 1,
    }));
  }

  getEnabledFieldNames(): string[] {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      SELECT field_name
      FROM monitored_fields
      WHERE enabled = 1
      ORDER BY field_name
    `);
    const rows = statement.all() as Array<{ field_name: string }>;
    return rows.map((row) => row.field_name);
  }

  enableField(fieldName: string): void {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      UPDATE monitored_fields
      SET enabled = 1
      WHERE field_name = ?
    `);
    statement.run(fieldName);
  }

  disableField(fieldName: string): void {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      UPDATE monitored_fields
      SET enabled = 0
      WHERE field_name = ?
    `);
    statement.run(fieldName);
  }

  getSchedulerSettings(): SchedulerSettings {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      SELECT key, value
      FROM configuration
      WHERE key IN (?, ?)
    `);
    const rows = statement.all('scheduler_enabled', 'scheduler_time') as ConfigurationRow[];
    const values = new Map(rows.map((row) => [row.key, row.value]));

    return {
      enabled: values.get('scheduler_enabled') !== 'false',
      time: values.get('scheduler_time') ?? '09:00',
    };
  }

  getDashboardMetric(): DashboardMetric {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      SELECT value
      FROM configuration
      WHERE key = ?
      LIMIT 1
    `);
    const row = statement.get('dashboard_metric') as { value: string } | undefined;
    const metric = row?.value;
    if (metric && isDashboardMetric(metric)) {
      return metric;
    }

    return 'units_in_circulation';
  }

  saveDashboardMetric(metric: DashboardMetric): void {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      INSERT INTO configuration (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    statement.run('dashboard_metric', metric);
  }

  saveSchedulerSettings(settings: SchedulerSettings): void {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      INSERT INTO configuration (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    const save = database.transaction(() => {
      statement.run('scheduler_enabled', settings.enabled ? 'true' : 'false');
      statement.run('scheduler_time', settings.time);
    });

    save();
  }
}
