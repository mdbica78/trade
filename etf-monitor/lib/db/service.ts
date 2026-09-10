import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

const CREATE_ETF_HISTORY_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS etf_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    report_date TEXT NOT NULL,
    units_in_circulation INTEGER,
    vuan REAL,
    net_assets REAL,
    report_url TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(symbol, report_date)
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

interface InsertHistoryEntry {
  symbol: string;
  reportDate: Date;
  unitsInCirculation: number | null;
  vuan: number | null;
  netAssets: number | null;
  reportUrl: string;
}

interface EtfHistoryRow {
  id: number;
  symbol: string;
  report_date: string;
  units_in_circulation: number | null;
  vuan: number | null;
  net_assets: number | null;
  report_url: string | null;
  created_at: string;
}

interface EtfHistoryWithDeltaRow {
  symbol: string;
  report_date: string;
  units_in_circulation: number | null;
  unitsDelta: number | null;
  unitsDeltaPercent: number | null;
  vuan: number | null;
  net_assets: number | null;
  report_url: string | null;
  created_at: string;
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
      DatabaseService.databaseInstance = new Database(databasePath);
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

  insertHistory(entry: InsertHistoryEntry): void {
    const statement = this.database.prepare(`
      INSERT INTO etf_history (
        symbol,
        report_date,
        units_in_circulation,
        vuan,
        net_assets,
        report_url,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    console.log({
      action: 'insert',
      symbol: entry.symbol,
      reportDate: entry.reportDate,
    });

    const result = statement.run(
      entry.symbol,
      entry.reportDate.toISOString(),
      entry.unitsInCirculation,
      entry.vuan,
      entry.netAssets,
      entry.reportUrl,
      new Date().toISOString(),
    );

    console.log({
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    });
  }

  updateHistory(entry: InsertHistoryEntry): void {
    const statement = this.database.prepare(`
      UPDATE etf_history
      SET
          units_in_circulation = ?,
          vuan = ?,
          net_assets = ?,
          report_url = ?,
          created_at = ?
      WHERE
          symbol = ?
      AND
          report_date = ?
    `);

    statement.run(
      entry.unitsInCirculation,
      entry.vuan,
      entry.netAssets,
      entry.reportUrl,
      new Date().toISOString(),
      entry.symbol,
      entry.reportDate.toISOString(),
    );
  }

  getLatestHistory(symbol: string): EtfHistoryRow | null {
    const statement = this.database.prepare(`
      SELECT
        id,
        symbol,
        report_date,
        units_in_circulation,
        vuan,
        net_assets,
        report_url,
        created_at
      FROM etf_history
      WHERE symbol = ?
      ORDER BY report_date DESC
      LIMIT 1
    `);

    const row = statement.get(symbol);
    if (!row) {
      return null;
    }

    return row as EtfHistoryRow;
  }

  getHistory(limit = 100): EtfHistoryRow[] {
    const statement = this.database.prepare(`
      SELECT *
      FROM etf_history
      ORDER BY report_date DESC, symbol ASC
      LIMIT ?
    `);

    const rows = statement.all(limit);
    return rows as EtfHistoryRow[];
  }

  getLatestHistoryForAll(): EtfHistoryRow[] {
    const statement = this.database.prepare(`
      SELECT *
      FROM etf_history h
      WHERE report_date = (
          SELECT MAX(report_date)
          FROM etf_history
          WHERE symbol = h.symbol
      )
      ORDER BY symbol
    `);

    const rows = statement.all();
    return rows as EtfHistoryRow[];
  }

  getLatestHistoryWithPrevious(): EtfHistoryWithDeltaRow[] {
    const latestRowsStatement = this.database.prepare(`
      SELECT
        symbol,
        report_date,
        units_in_circulation,
        vuan,
        net_assets,
        report_url,
        created_at
      FROM etf_history h
      WHERE report_date = (
          SELECT MAX(report_date)
          FROM etf_history
          WHERE symbol = h.symbol
      )
      ORDER BY symbol
    `);

    const previousRowStatement = this.database.prepare(`
      SELECT units_in_circulation
      FROM etf_history
      WHERE symbol = ? AND report_date < ?
      ORDER BY report_date DESC
      LIMIT 1
    `);

    const latestRows = latestRowsStatement.all() as Array<{
      symbol: string;
      report_date: string;
      units_in_circulation: number | null;
      vuan: number | null;
      net_assets: number | null;
      report_url: string | null;
      created_at: string;
    }>;

    return latestRows.map((latestRow) => {
      const previousRow = previousRowStatement.get(
        latestRow.symbol,
        latestRow.report_date,
      ) as { units_in_circulation: number | null } | undefined;

      const unitsDelta =
        previousRow &&
        latestRow.units_in_circulation !== null &&
        previousRow.units_in_circulation !== null
          ? latestRow.units_in_circulation - previousRow.units_in_circulation
          : null;
      const unitsDeltaPercent =
        previousRow &&
        latestRow.units_in_circulation !== null &&
        previousRow.units_in_circulation !== null &&
        previousRow.units_in_circulation !== 0
          ? ((latestRow.units_in_circulation - previousRow.units_in_circulation) /
              previousRow.units_in_circulation) *
            100
          : null;

      return {
        symbol: latestRow.symbol,
        report_date: latestRow.report_date,
        units_in_circulation: latestRow.units_in_circulation,
        unitsDelta,
        unitsDeltaPercent,
        vuan: latestRow.vuan,
        net_assets: latestRow.net_assets,
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

  private initializeDatabase(): void {
    this.database.exec(CREATE_ETF_HISTORY_TABLE_SQL);
    this.database.exec(CREATE_SYNC_RUNS_TABLE_SQL);
    this.database.exec(CREATE_MONITORED_ETFS_TABLE_SQL);
    this.database.exec(CREATE_MONITORED_FIELDS_TABLE_SQL);
    this.seedDefaultMonitoredEtfs();
    this.seedDefaultMonitoredFields();
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
}
