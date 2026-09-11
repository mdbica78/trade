import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { SUPPORTED_METRIC_KEYS, type MetricKey, type MetricValueMap } from '../types';

const CREATE_ETF_HISTORY_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS etf_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    report_date TEXT NOT NULL,
    report_url TEXT,
    created_at TEXT NOT NULL
);
`;

const CREATE_ETF_METRICS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS etf_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    history_id INTEGER NOT NULL,
    metric_key TEXT NOT NULL,
    metric_value REAL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(history_id) REFERENCES etf_history(id) ON DELETE CASCADE,
    UNIQUE(history_id, metric_key)
);
`;

const CREATE_SYNC_RUNS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL
);
`;

const CREATE_MONITORED_ETFS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS monitored_etfs (
    symbol TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL
);
`;

const CREATE_MONITORED_FIELDS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS monitored_fields (
    field_name TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    enabled INTEGER NOT NULL
);
`;

const CREATE_CONFIGURATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS configuration (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;

const DELETE_DUPLICATE_HISTORY_SQL = `
DELETE FROM etf_history
WHERE id NOT IN (
    SELECT MAX(id)
    FROM etf_history
    GROUP BY symbol, report_date
);
`;

const CREATE_HISTORY_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_history_symbol_date
ON etf_history(symbol, report_date);
`;

const CREATE_HISTORY_LOOKUP_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_history_symbol_date_id
ON etf_history(symbol, report_date DESC, id DESC);
`;

const CREATE_ETF_METRICS_LOOKUP_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_etf_metrics_metric_history
ON etf_metrics(metric_key, history_id);
`;

const METRIC_KEY_SET = new Set<string>(SUPPORTED_METRIC_KEYS);

const DEFAULT_MONITORED_ETFS = [
  'TVBETETF',
  'PTENGETF',
  'BTBETRETF',
  'BKBETETF',
  'GIBEFETF',
  'GIBXTETF',
] as const;

const DEFAULT_MONITORED_FIELDS = [
  {
    fieldName: 'units_in_circulation',
    displayName: 'Units in Circulation',
    enabled: 1,
  },
  {
    fieldName: 'vuan',
    displayName: 'VUAN',
    enabled: 1,
  },
  {
    fieldName: 'net_assets',
    displayName: 'Net Assets',
    enabled: 1,
  },
] as const;

const DEFAULT_CONFIGURATION = [
  { key: 'scheduler_enabled', value: 'true' },
  { key: 'scheduler_time', value: '09:00' },
  { key: 'dashboard_metric', value: 'units_in_circulation' },
] as const;

interface UpsertHistoryEntry {
  symbol: string;
  reportDate: Date;
  metrics: MetricValueMap;
  reportUrl: string;
}

interface EtfHistoryRecordRow {
  id: number;
  symbol: string;
  report_date: string;
  report_url: string | null;
  created_at: string;
}

interface EtfHistoryMetricJoinRow extends EtfHistoryRecordRow {
  metric_key: string | null;
  metric_value: number | null;
}

interface EtfHistoryRow extends EtfHistoryRecordRow {
  units_in_circulation: number | null;
  vuan: number | null;
  net_assets: number | null;
}

interface EtfHistoryWithDeltaRow extends EtfHistoryRow {
  previous_units_in_circulation: number | null;
  previous_vuan: number | null;
  previous_net_assets: number | null;
}

interface SyncOverview {
  status: 'Completed' | 'Running' | 'Failed';
  completedAt: string | null;
  durationSeconds: number | null;
}

export class DatabaseService {
  private static databaseInstance: InstanceType<typeof Database> | null = null;
  private static isInitialized = false;
  private readonly database: InstanceType<typeof Database>;

  constructor() {
    if (!DatabaseService.databaseInstance) {
      const databasePath = resolve(process.cwd(), 'data', 'etf-monitor.db');
      console.log({ databasePath });
      mkdirSync(dirname(databasePath), { recursive: true });
      const database = new Database(databasePath);
      database.pragma('busy_timeout = 5000');
      database.pragma('foreign_keys = ON');
      DatabaseService.databaseInstance = database;
    }

    this.database = DatabaseService.databaseInstance;

    if (!DatabaseService.isInitialized) {
      this.initializeDatabase();
      DatabaseService.isInitialized = true;
    }
  }

  getDatabase(): InstanceType<typeof Database> {
    return this.database;
  }

  insertHistory(entry: UpsertHistoryEntry): void {
    const insertHistoryStatement = this.database.prepare(`
      INSERT INTO etf_history (
        symbol,
        report_date,
        report_url,
        created_at
      ) VALUES (?, ?, ?, ?)
    `);

    const insert = this.database.transaction(() => {
      const createdAt = new Date().toISOString();
      const result = insertHistoryStatement.run(
        entry.symbol,
        entry.reportDate.toISOString(),
        entry.reportUrl,
        createdAt,
      );
      const historyId = Number(result.lastInsertRowid);
      this.upsertMetricValues(historyId, entry.metrics, createdAt);

      return {
        createdAt,
        changes: result.changes,
        historyId,
      };
    });

    const insertResult = insert();
    console.log({
      action: 'insert',
      symbol: entry.symbol,
      reportDate: entry.reportDate,
      changes: insertResult.changes,
      lastInsertRowid: insertResult.historyId,
      createdAt: insertResult.createdAt,
    });
  }

  updateHistory(entry: UpsertHistoryEntry): void {
    const reportDateKey = entry.reportDate.toISOString().substring(0, 10);
    const updateHistoryStatement = this.database.prepare(`
      UPDATE etf_history
      SET
          report_url = ?,
          created_at = ?
      WHERE
          symbol = ?
      AND
          substr(report_date, 1, 10) = ?
    `);
    const getHistoryIdStatement = this.database.prepare(`
      SELECT id
      FROM etf_history
      WHERE symbol = ? AND substr(report_date, 1, 10) = ?
      ORDER BY report_date DESC, id DESC
      LIMIT 1
    `);

    const update = this.database.transaction(() => {
      const createdAt = new Date().toISOString();
      updateHistoryStatement.run(entry.reportUrl, createdAt, entry.symbol, reportDateKey);

      const historyRow = getHistoryIdStatement.get(entry.symbol, reportDateKey) as
        | { id: number }
        | undefined;
      if (!historyRow) {
        return;
      }

      this.upsertMetricValues(historyRow.id, entry.metrics, createdAt);
    });

    update();
  }

  getLatestHistory(symbol: string): EtfHistoryRow | null {
    const statement = this.database.prepare(`
      SELECT
        h.id,
        h.symbol,
        h.report_date,
        h.report_url,
        h.created_at,
        m.metric_key,
        m.metric_value
      FROM etf_history h
      LEFT JOIN etf_metrics m ON m.history_id = h.id
      WHERE h.id = (
          SELECT id
          FROM etf_history
          WHERE symbol = ?
          ORDER BY report_date DESC, id DESC
          LIMIT 1
      )
      ORDER BY h.id, m.metric_key
    `);

    const rows = statement.all(symbol) as EtfHistoryMetricJoinRow[];
    if (rows.length === 0) {
      return null;
    }

    return this.mapHistoryMetricRows(rows)[0] ?? null;
  }

  getHistoryForReportDate(symbol: string, reportDate: Date): EtfHistoryRecordRow | null {
    const reportDateKey = reportDate.toISOString().substring(0, 10);
    const statement = this.database.prepare(`
      SELECT
        id,
        symbol,
        report_date,
        report_url,
        created_at
      FROM etf_history
      WHERE symbol = ? AND substr(report_date, 1, 10) = ?
      ORDER BY report_date DESC, id DESC
      LIMIT 1
    `);
    const row = statement.get(symbol, reportDateKey);
    if (!row) {
      return null;
    }

    return row as EtfHistoryRecordRow;
  }

  getHistory(limit = 100): EtfHistoryRow[] {
    const statement = this.database.prepare(`
      SELECT
        h.id,
        h.symbol,
        h.report_date,
        h.report_url,
        h.created_at,
        m.metric_key,
        m.metric_value
      FROM etf_history h
      LEFT JOIN etf_metrics m ON m.history_id = h.id
      WHERE h.id IN (
          SELECT id
          FROM etf_history
          ORDER BY report_date DESC, symbol ASC, id DESC
          LIMIT ?
      )
      ORDER BY h.report_date DESC, h.symbol ASC, h.id DESC, m.metric_key ASC
    `);

    const rows = statement.all(limit) as EtfHistoryMetricJoinRow[];
    return this.mapHistoryMetricRows(rows);
  }

  getLatestHistoryForAll(): EtfHistoryRow[] {
    const statement = this.database.prepare(`
      SELECT
        h.id,
        h.symbol,
        h.report_date,
        h.report_url,
        h.created_at,
        m.metric_key,
        m.metric_value
      FROM etf_history h
      LEFT JOIN etf_metrics m ON m.history_id = h.id
      WHERE h.id = (
          SELECT id
          FROM etf_history
          WHERE symbol = h.symbol
          ORDER BY report_date DESC, id DESC
          LIMIT 1
      )
      ORDER BY h.symbol, m.metric_key
    `);

    const rows = statement.all() as EtfHistoryMetricJoinRow[];
    return this.mapHistoryMetricRows(rows);
  }

  getLatestHistoryWithPrevious(): EtfHistoryWithDeltaRow[] {
    const latestRowsStatement = this.database.prepare(`
      SELECT
        h.id,
        h.symbol,
        h.report_date,
        h.report_url,
        h.created_at,
        metric.metric_key,
        metric.metric_value
      FROM etf_history h
      INNER JOIN monitored_etfs monitored ON monitored.symbol = h.symbol
      LEFT JOIN etf_metrics metric ON metric.history_id = h.id
      WHERE h.id = (
          SELECT id
          FROM etf_history
          WHERE symbol = h.symbol
          ORDER BY report_date DESC, id DESC
          LIMIT 1
      )
      AND monitored.enabled = 1
      ORDER BY monitored.rowid, metric.metric_key
    `);

    const previousMetricStatement = this.database.prepare(`
      SELECT metric.metric_value
      FROM etf_history history
      INNER JOIN etf_metrics metric ON metric.history_id = history.id
      WHERE history.symbol = ?
        AND history.id <> ?
        AND metric.metric_key = ?
        AND metric.metric_value IS NOT NULL
      ORDER BY history.report_date DESC, history.id DESC
      LIMIT 1
    `);

    const latestMetricRows = latestRowsStatement.all() as EtfHistoryMetricJoinRow[];
    const latestRows = this.mapHistoryMetricRows(latestMetricRows);

    return latestRows.map((latestRow) => {
      const previousMetricValues = this.createEmptyMetricValueMap();

      for (const metricKey of SUPPORTED_METRIC_KEYS) {
        const previousMetricRow = previousMetricStatement.get(
          latestRow.symbol,
          latestRow.id,
          metricKey,
        ) as { metric_value: number | null } | undefined;

        previousMetricValues[metricKey] = previousMetricRow?.metric_value ?? null;
      }

      return {
        id: latestRow.id,
        symbol: latestRow.symbol,
        report_date: latestRow.report_date,
        units_in_circulation: latestRow.units_in_circulation,
        previous_units_in_circulation: previousMetricValues.units_in_circulation,
        vuan: latestRow.vuan,
        previous_vuan: previousMetricValues.vuan,
        net_assets: latestRow.net_assets,
        previous_net_assets: previousMetricValues.net_assets,
        report_url: latestRow.report_url,
        created_at: latestRow.created_at,
      };
    });
  }

  createSyncRun(): number {
    const statement = this.database.prepare(`
      INSERT INTO sync_runs (started_at, status)
      VALUES (?, ?)
    `);
    const result = statement.run(new Date().toISOString(), 'running');
    return Number(result.lastInsertRowid);
  }

  markSyncRunCompleted(id: number): void {
    const statement = this.database.prepare(`
      UPDATE sync_runs
      SET completed_at = ?, status = ?
      WHERE id = ?
    `);
    statement.run(new Date().toISOString(), 'completed', id);
  }

  markSyncRunFailed(id: number): void {
    const statement = this.database.prepare(`
      UPDATE sync_runs
      SET completed_at = ?, status = ?
      WHERE id = ?
    `);
    statement.run(new Date().toISOString(), 'failed', id);
  }

  getSyncOverview(): SyncOverview {
    const latestRunStatement = this.database.prepare(`
      SELECT status
      FROM sync_runs
      ORDER BY started_at DESC, id DESC
      LIMIT 1
    `);

    const latestCompletedStatement = this.database.prepare(`
      SELECT started_at, completed_at
      FROM sync_runs
      WHERE status = ? AND completed_at IS NOT NULL
      ORDER BY completed_at DESC, id DESC
      LIMIT 1
    `);

    const latestRun = latestRunStatement.get() as { status: string } | undefined;
    const latestCompleted = latestCompletedStatement.get('completed') as
      | { started_at: string; completed_at: string }
      | undefined;

    let status: SyncOverview['status'] = 'Failed';
    if (latestRun?.status === 'completed') {
      status = 'Completed';
    } else if (latestRun?.status === 'running') {
      status = 'Running';
    }

    const durationSeconds =
      latestCompleted &&
      !Number.isNaN(new Date(latestCompleted.started_at).getTime()) &&
      !Number.isNaN(new Date(latestCompleted.completed_at).getTime())
        ? (new Date(latestCompleted.completed_at).getTime() -
            new Date(latestCompleted.started_at).getTime()) /
          1000
        : null;

    return {
      status,
      completedAt: latestCompleted?.completed_at ?? null,
      durationSeconds,
    };
  }

  private initializeDatabase(): void {
    this.ensureWalMode();
    this.database.exec(CREATE_ETF_HISTORY_TABLE_SQL);
    this.database.exec(CREATE_ETF_METRICS_TABLE_SQL);
    this.database.exec(CREATE_SYNC_RUNS_TABLE_SQL);
    this.database.exec(CREATE_MONITORED_ETFS_TABLE_SQL);
    this.database.exec(CREATE_MONITORED_FIELDS_TABLE_SQL);
    this.database.exec(CREATE_CONFIGURATION_TABLE_SQL);
    this.runHistoryDeduplicationMigration();
    this.runLookupIndexesMigration();
    this.seedDefaultMonitoredEtfs();
    this.seedDefaultMonitoredFields();
    this.seedDefaultConfiguration();
  }

  private ensureWalMode(): void {
    const journalMode = String(this.database.pragma('journal_mode', { simple: true })).toLowerCase();
    if (journalMode !== 'wal') {
      this.database.pragma('journal_mode = WAL');
    }
  }

  private runHistoryDeduplicationMigration(): void {
    const migrate = this.database.transaction(() => {
      this.database.exec(DELETE_DUPLICATE_HISTORY_SQL);
      this.database.exec(CREATE_HISTORY_UNIQUE_INDEX_SQL);
    });

    migrate();
  }

  private runLookupIndexesMigration(): void {
    const migrate = this.database.transaction(() => {
      this.database.exec(CREATE_HISTORY_LOOKUP_INDEX_SQL);
      this.database.exec(CREATE_ETF_METRICS_LOOKUP_INDEX_SQL);
    });

    migrate();
  }

  private seedDefaultMonitoredEtfs(): void {
    const insertStatement = this.database.prepare(`
      INSERT OR IGNORE INTO monitored_etfs (symbol, enabled)
      VALUES (?, ?)
    `);
    for (const symbol of DEFAULT_MONITORED_ETFS) {
      insertStatement.run(symbol, 1);
    }
  }

  private seedDefaultMonitoredFields(): void {
    const insertStatement = this.database.prepare(`
      INSERT OR IGNORE INTO monitored_fields (field_name, display_name, enabled)
      VALUES (?, ?, ?)
    `);
    for (const field of DEFAULT_MONITORED_FIELDS) {
      insertStatement.run(field.fieldName, field.displayName, field.enabled);
    }
  }

  private seedDefaultConfiguration(): void {
    const insertStatement = this.database.prepare(`
      INSERT OR IGNORE INTO configuration (key, value)
      VALUES (?, ?)
    `);
    for (const item of DEFAULT_CONFIGURATION) {
      insertStatement.run(item.key, item.value);
    }
  }

  private upsertMetricValues(historyId: number, metrics: MetricValueMap, createdAt: string): void {
    const statement = this.database.prepare(`
      INSERT INTO etf_metrics (history_id, metric_key, metric_value, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(history_id, metric_key) DO UPDATE SET
          metric_value = excluded.metric_value,
          created_at = excluded.created_at
    `);

    for (const metricKey of SUPPORTED_METRIC_KEYS) {
      statement.run(historyId, metricKey, metrics[metricKey], createdAt);
    }
  }

  private mapHistoryMetricRows(rows: EtfHistoryMetricJoinRow[]): EtfHistoryRow[] {
    const historyById = new Map<number, EtfHistoryRow>();

    for (const row of rows) {
      let historyRow = historyById.get(row.id);
      if (!historyRow) {
        historyRow = {
          id: row.id,
          symbol: row.symbol,
          report_date: row.report_date,
          units_in_circulation: null,
          vuan: null,
          net_assets: null,
          report_url: row.report_url,
          created_at: row.created_at,
        };
        historyById.set(row.id, historyRow);
      }

      if (typeof row.metric_key === 'string' && this.isMetricKey(row.metric_key)) {
        historyRow[row.metric_key] = row.metric_value;
      }
    }

    return Array.from(historyById.values());
  }

  private createEmptyMetricValueMap(): MetricValueMap {
    const values = {} as MetricValueMap;
    for (const metricKey of SUPPORTED_METRIC_KEYS) {
      values[metricKey] = null;
    }

    return values;
  }

  private isMetricKey(value: string): value is MetricKey {
    return METRIC_KEY_SET.has(value);
  }
}
