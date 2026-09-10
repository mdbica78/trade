import { DatabaseService } from '../db';

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

export class ConfigService {
  getAllMonitoredEtfs(): MonitoredEtf[] {
    const databaseService = new DatabaseService();
    const database = databaseService.getDatabase();
    const statement = database.prepare(`
      SELECT
          symbol,
          enabled
      FROM monitored_etfs
      ORDER BY symbol
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
      ORDER BY symbol
    `);
    const rows = statement.all() as Array<{ symbol: string }>;
    return rows.map((row) => row.symbol);
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
}
