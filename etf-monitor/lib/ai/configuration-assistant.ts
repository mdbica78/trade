import { BVBService } from '../bvb';
import {
  ConfigService,
  type AddMonitoredMetricInput,
  type MonitoredField,
  type MonitoredEtf,
} from '../config/service';
import { PDFService } from '../pdf';
import { AIProvider, type AIIntentCategory, type AIRequest, type AIResponse } from '../types';

type PendingOperation =
  | {
      intent: 'ADD_ETF';
      payload: {
        symbol: string;
        name: string;
        isin: string;
        bvbSymbol: string;
      };
    }
  | {
      intent: 'REMOVE_ETF';
      payload: {
        symbol: string;
      };
    }
  | {
      intent: 'ADD_METRIC';
      payload: {
        field: MonitoredField;
      };
    }
  | {
      intent: 'REMOVE_METRIC';
      payload: {
        fieldName: string;
      };
    }
  | {
      intent: 'SET_DASHBOARD_METRIC';
      payload: {
        fieldName: string;
      };
    };

function normalizeText(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseBooleanConfirmation(prompt: string): boolean {
  return /^(confirm|yes|approved|proceed|do it|ok)\b/i.test(prompt.trim());
}

function trimSurroundingQuotes(value: string): string {
  return value.replace(/^["']+|["']+$/g, '').trim();
}

function extractCandidateAfterVerb(prompt: string, pattern: RegExp): string | null {
  const match = prompt.match(pattern);
  if (!match) {
    return null;
  }

  const candidate = match[1]?.trim();
  if (!candidate) {
    return null;
  }

  return trimSurroundingQuotes(candidate);
}

function extractSourceEtfCandidate(prompt: string): string | null {
  const forEtfMatch = prompt.match(/\bfor\s+(?:etf\s+)?([A-Za-z0-9]{2,20})\b/i);
  if (forEtfMatch?.[1]) {
    return forEtfMatch[1].trim();
  }

  const fromEtfMatch = prompt.match(
    /\bfrom\s+(?:the\s+)?(?:etf\s+)?([A-Za-z0-9]{2,20})(?:\s+(?:pdf|report))?\b/i,
  );
  if (fromEtfMatch?.[1]) {
    return fromEtfMatch[1].trim();
  }

  const addEtfMatch = prompt.match(/\badd\s+etf\s+([A-Za-z0-9]{2,20})\b/i);
  if (addEtfMatch?.[1]) {
    return addEtfMatch[1].trim();
  }

  return null;
}

function stripSourceEtfContext(metricCandidate: string): string {
  return metricCandidate
    .replace(/\bfor\s+(?:etf\s+)?[A-Za-z0-9]{2,20}\b/gi, '')
    .replace(/\s+\bfrom\s+(?:the\s+)?(?:etf\s+)?[A-Za-z0-9]{2,20}(?:\s+(?:pdf|report))?\b\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function serializePendingOperation(operation: PendingOperation): string {
  return Buffer.from(JSON.stringify(operation), 'utf8').toString('base64url');
}

function deserializePendingOperation(token: string): PendingOperation {
  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  const parsed = JSON.parse(decoded) as unknown;

  if (typeof parsed !== 'object' || parsed === null || !('intent' in parsed) || !('payload' in parsed)) {
    throw new Error('Invalid confirmation token');
  }

  const operation = parsed as PendingOperation;
  if (
    operation.intent !== 'ADD_ETF' &&
    operation.intent !== 'REMOVE_ETF' &&
    operation.intent !== 'ADD_METRIC' &&
    operation.intent !== 'REMOVE_METRIC' &&
    operation.intent !== 'SET_DASHBOARD_METRIC'
  ) {
    throw new Error('Invalid confirmation token');
  }

  return operation;
}

function toConfigurationData(
  etfs: MonitoredEtf[],
  fields: MonitoredField[],
  dashboardMetric: string,
  scheduler: { enabled: boolean; time: string },
): Record<string, unknown> {
  return {
    monitoredEtfs: etfs.map((etf) => ({
      symbol: etf.symbol,
      name: etf.name,
      isin: etf.isin,
      bvbSymbol: etf.bvbSymbol,
      enabled: etf.enabled,
    })),
    monitoredFields: fields.map((field) => ({
      fieldName: field.fieldName,
      displayName: field.displayName,
      extractorKey: field.extractorKey,
      extractionHint: field.extractionHint,
      extractionPattern: field.extractionPattern,
      enabled: field.enabled,
    })),
    dashboardMetric,
    scheduler,
  };
}

function getIntent(prompt: string): AIIntentCategory {
  const normalizedPrompt = normalizeText(prompt);

  if (
    normalizedPrompt.includes('show configuration') ||
    normalizedPrompt.includes('show config') ||
    normalizedPrompt.includes('current configuration')
  ) {
    return 'SHOW_CONFIGURATION';
  }

  if (
    normalizedPrompt.includes('explain configuration') ||
    normalizedPrompt.includes('explain config') ||
    normalizedPrompt.includes('why this configuration')
  ) {
    return 'EXPLAIN_CONFIGURATION';
  }

  if (
    normalizedPrompt.includes('dashboard metric') ||
    normalizedPrompt.includes('main dashboard metric')
  ) {
    return 'SET_DASHBOARD_METRIC';
  }

  if (
    normalizedPrompt.includes('remove metric') ||
    normalizedPrompt.includes('disable metric') ||
    normalizedPrompt.startsWith('remove vuan') ||
    normalizedPrompt.startsWith('remove net assets')
  ) {
    return 'REMOVE_METRIC';
  }

  if (
    normalizedPrompt.includes('add metric') ||
    normalizedPrompt.includes('extract') ||
    normalizedPrompt.includes('monitor this field') ||
    normalizedPrompt.includes('monitor this metric') ||
    normalizedPrompt.includes('fund size') ||
    normalizedPrompt.includes('vuan') ||
    normalizedPrompt.includes('net assets') ||
    normalizedPrompt.includes('activ net') ||
    normalizedPrompt.includes('units in circulation')
  ) {
    return 'ADD_METRIC';
  }

  if (
    normalizedPrompt.includes('remove etf') ||
    normalizedPrompt.includes('stop monitoring') ||
    normalizedPrompt.includes('disable etf')
  ) {
    return 'REMOVE_ETF';
  }

  if (
    normalizedPrompt.includes('add etf') ||
    normalizedPrompt.includes('monitor this etf') ||
    normalizedPrompt.includes('monitor etf') ||
    normalizedPrompt.startsWith('add ')
  ) {
    return 'ADD_ETF';
  }

  return 'UNKNOWN';
}

function buildMetricDefinitionPayload(field: MonitoredField): AddMonitoredMetricInput {
  return {
    fieldName: field.fieldName,
    displayName: field.displayName,
    extractorKey: field.extractorKey,
    extractionHint: field.extractionHint,
    extractionPattern: field.extractionPattern,
    enabled: true,
  };
}

export class ConfigurationAssistantService {
  private readonly configService = new ConfigService();
  private readonly bvbService = new BVBService();
  private readonly pdfService = new PDFService();

  async chat(request: AIRequest): Promise<AIResponse> {
    const confirmRequest = request.confirm === true || parseBooleanConfirmation(request.prompt);
    if (confirmRequest) {
      if (!request.confirmationToken) {
        return {
          provider: AIProvider.MOCK,
          success: false,
          message: 'Confirmation token is required to apply the pending configuration change.',
        };
      }

      return this.executeConfirmedOperation(request.confirmationToken);
    }

    const intent = getIntent(request.prompt);
    switch (intent) {
      case 'SHOW_CONFIGURATION':
        return this.showConfiguration();
      case 'EXPLAIN_CONFIGURATION':
        return this.explainConfiguration();
      case 'ADD_ETF':
        return this.prepareAddEtf(request.prompt);
      case 'REMOVE_ETF':
        return this.prepareRemoveEtf(request.prompt);
      case 'ADD_METRIC':
        return this.prepareAddMetric(request.prompt);
      case 'REMOVE_METRIC':
        return this.prepareRemoveMetric(request.prompt);
      case 'SET_DASHBOARD_METRIC':
        return this.prepareSetDashboardMetric(request.prompt);
      default:
        return {
          provider: AIProvider.MOCK,
          success: false,
          intent: 'UNKNOWN',
          message:
            'I could not determine the requested configuration action. Please ask to add/remove an ETF, add/remove a metric, set dashboard metric, or show configuration.',
        };
    }
  }

  private async showConfiguration(): Promise<AIResponse> {
    const snapshot = await this.configService.getConfiguration();
    return {
      provider: AIProvider.MOCK,
      success: true,
      intent: 'SHOW_CONFIGURATION',
      message: 'Current configuration loaded.',
      data: toConfigurationData(
        snapshot.etfs,
        snapshot.fields,
        snapshot.dashboardMetric,
        snapshot.scheduler,
      ),
    };
  }

  private async explainConfiguration(): Promise<AIResponse> {
    const snapshot = await this.configService.getConfiguration();
    const enabledEtfs = snapshot.etfs.filter((etf) => etf.enabled);
    const enabledFields = snapshot.fields.filter((field) => field.enabled);
    const dashboardField = snapshot.fields.find((field) => field.fieldName === snapshot.dashboardMetric);

    return {
      provider: AIProvider.MOCK,
      success: true,
      intent: 'EXPLAIN_CONFIGURATION',
      message:
        `Monitoring ${enabledEtfs.length} ETF(s), collecting ${enabledFields.length} metric(s), ` +
        `dashboard metric is ${dashboardField?.displayName ?? snapshot.dashboardMetric}.`,
      data: toConfigurationData(
        snapshot.etfs,
        snapshot.fields,
        snapshot.dashboardMetric,
        snapshot.scheduler,
      ),
    };
  }

  private async prepareAddEtf(prompt: string): Promise<AIResponse> {
    const candidate =
      extractCandidateAfterVerb(prompt, /(?:add|monitor)(?:\s+etf)?\s+(.+)$/i) ??
      extractCandidateAfterVerb(prompt, /^(.+)$/i);

    if (!candidate) {
      return {
        provider: AIProvider.MOCK,
        success: false,
        intent: 'ADD_ETF',
        message: 'Please provide the ETF symbol or name to add.',
      };
    }

    const validated = await this.configService.validateEtf(candidate, this.bvbService);
    const existing = await this.configService.getMonitoredEtf(validated.symbol);
    if (existing?.enabled) {
      return {
        provider: AIProvider.MOCK,
        success: true,
        intent: 'ADD_ETF',
        message: `ETF ${validated.symbol} is already monitored.`,
      };
    }

    const operation: PendingOperation = {
      intent: 'ADD_ETF',
      payload: {
        symbol: validated.symbol,
        name: validated.name,
        isin: validated.isin,
        bvbSymbol: validated.bvbSymbol,
      },
    };

    return {
      provider: AIProvider.MOCK,
      success: true,
      intent: 'ADD_ETF',
      requiresConfirmation: true,
      confirmationToken: serializePendingOperation(operation),
      message:
        `Found ${validated.symbol} on BVB (${validated.name}). ` +
        `Latest report date ${new Date(validated.latestReportDate).toLocaleDateString()}. Confirm to add it.`,
      data: {
        symbol: validated.symbol,
        name: validated.name,
        isin: validated.isin,
        bvbSymbol: validated.bvbSymbol,
        latestReportDate: validated.latestReportDate,
        latestReportUrl: validated.latestReportUrl,
      },
    };
  }

  private async prepareRemoveEtf(prompt: string): Promise<AIResponse> {
    const candidate = extractCandidateAfterVerb(
      prompt,
      /(?:remove|disable|stop monitoring)(?:\s+etf)?\s+([A-Za-z0-9]+)$/i,
    );
    if (!candidate) {
      return {
        provider: AIProvider.MOCK,
        success: false,
        intent: 'REMOVE_ETF',
        message: 'Please provide the ETF symbol to remove.',
      };
    }

    const symbol = candidate.trim().toUpperCase();
    const monitored = await this.configService.getMonitoredEtf(symbol);
    if (!monitored || !monitored.enabled) {
      return {
        provider: AIProvider.MOCK,
        success: false,
        intent: 'REMOVE_ETF',
        message: `ETF ${symbol} is not currently monitored.`,
      };
    }

    const operation: PendingOperation = {
      intent: 'REMOVE_ETF',
      payload: { symbol },
    };

    return {
      provider: AIProvider.MOCK,
      success: true,
      intent: 'REMOVE_ETF',
      requiresConfirmation: true,
      confirmationToken: serializePendingOperation(operation),
      message: `I can stop monitoring ETF ${symbol}. Confirm to proceed.`,
      data: { symbol },
    };
  }

  private async prepareAddMetric(prompt: string): Promise<AIResponse> {
    const rawCandidate =
      extractCandidateAfterVerb(prompt, /(?:add|extract|monitor)(?:\s+(?:metric|field))?\s+(.+)$/i) ??
      extractCandidateAfterVerb(prompt, /^(.+)$/i);

    if (!rawCandidate) {
      return {
        provider: AIProvider.MOCK,
        success: false,
        intent: 'ADD_METRIC',
        message: 'Please provide the metric name to add.',
      };
    }

    const sourceEtfCandidate = extractSourceEtfCandidate(prompt);
    const strippedMetricCandidate = stripSourceEtfContext(rawCandidate);
    const metricCandidate = trimSurroundingQuotes(strippedMetricCandidate || rawCandidate);
    let sourceSymbol: string | undefined;
    if (sourceEtfCandidate) {
      const validatedEtf = await this.configService.validateEtf(sourceEtfCandidate, this.bvbService);
      sourceSymbol = validatedEtf.symbol;
    }

    const validation = await this.configService.validateMetric(
      metricCandidate,
      this.bvbService,
      this.pdfService,
      sourceSymbol,
    );
    if (validation.alreadyExists && validation.alreadyEnabled) {
      return {
        provider: AIProvider.MOCK,
        success: true,
        intent: 'ADD_METRIC',
        message: `Metric "${validation.field.displayName}" already exists and is enabled.`,
        data: {
          fieldName: validation.field.fieldName,
          displayName: validation.field.displayName,
          extractorKey: validation.field.extractorKey,
          extractionHint: validation.field.extractionHint,
          extractionPattern: validation.field.extractionPattern,
          sourceSymbol: validation.sourceSymbol,
          latestReportDate: validation.latestReportDate,
          latestReportUrl: validation.latestReportUrl,
          alreadyExists: true,
        },
      };
    }

    const operation: PendingOperation = {
      intent: 'ADD_METRIC',
      payload: {
        field: validation.field,
      },
    };

    return {
      provider: AIProvider.MOCK,
      success: true,
      intent: 'ADD_METRIC',
      requiresConfirmation: true,
      confirmationToken: serializePendingOperation(operation),
      message:
        `Validated metric "${validation.field.displayName}" using ${validation.sourceSymbol} report ` +
        `${new Date(validation.latestReportDate).toLocaleDateString()} (sample ${validation.sampleValue}). ` +
        'Confirm to persist.',
      data: {
        fieldName: validation.field.fieldName,
        displayName: validation.field.displayName,
        extractorKey: validation.field.extractorKey,
        extractionHint: validation.field.extractionHint,
        extractionPattern: validation.field.extractionPattern,
        sampleValue: validation.sampleValue,
        sourceSymbol: validation.sourceSymbol,
        latestReportDate: validation.latestReportDate,
        latestReportUrl: validation.latestReportUrl,
        alreadyExists: validation.alreadyExists,
      },
    };
  }

  private async prepareRemoveMetric(prompt: string): Promise<AIResponse> {
    const candidate =
      extractCandidateAfterVerb(prompt, /(?:remove|disable)(?:\s+(?:metric|field))?\s+(.+)$/i) ??
      extractCandidateAfterVerb(prompt, /^remove\s+(.+)$/i);

    if (!candidate) {
      return {
        provider: AIProvider.MOCK,
        success: false,
        intent: 'REMOVE_METRIC',
        message: 'Please provide the metric key or display name to remove.',
      };
    }

    const fields = await this.configService.getAllMonitoredFields();
    const normalizedCandidate = normalizeText(candidate);
    const matchedField = fields.find((field) => {
      return (
        normalizeText(field.fieldName.replace(/_/g, ' ')) === normalizedCandidate ||
        normalizeText(field.displayName) === normalizedCandidate
      );
    });

    if (!matchedField) {
      return {
        provider: AIProvider.MOCK,
        success: false,
        intent: 'REMOVE_METRIC',
        message: `Metric "${candidate}" does not exist in configuration.`,
      };
    }

    const operation: PendingOperation = {
      intent: 'REMOVE_METRIC',
      payload: {
        fieldName: matchedField.fieldName,
      },
    };

    return {
      provider: AIProvider.MOCK,
      success: true,
      intent: 'REMOVE_METRIC',
      requiresConfirmation: true,
      confirmationToken: serializePendingOperation(operation),
      message: `I can disable metric ${matchedField.displayName}. Confirm to proceed.`,
      data: {
        fieldName: matchedField.fieldName,
        displayName: matchedField.displayName,
      },
    };
  }

  private async prepareSetDashboardMetric(prompt: string): Promise<AIResponse> {
    const candidate = extractCandidateAfterVerb(
      prompt,
      /(?:set|use)(?:\s+the)?(?:\s+main)?(?:\s+dashboard)?(?:\s+metric)?\s+(?:to|as)?\s+(.+)$/i,
    );
    if (!candidate) {
      return {
        provider: AIProvider.MOCK,
        success: false,
        intent: 'SET_DASHBOARD_METRIC',
        message: 'Please provide the metric key or display name to set as dashboard metric.',
      };
    }

    const fields = await this.configService.getAllMonitoredFields();
    const normalizedCandidate = normalizeText(candidate);
    const matchedField = fields.find((field) => {
      return (
        normalizeText(field.fieldName.replace(/_/g, ' ')) === normalizedCandidate ||
        normalizeText(field.displayName) === normalizedCandidate
      );
    });

    if (!matchedField) {
      return {
        provider: AIProvider.MOCK,
        success: false,
        intent: 'SET_DASHBOARD_METRIC',
        message: `Metric "${candidate}" was not found in monitored fields.`,
      };
    }

    const operation: PendingOperation = {
      intent: 'SET_DASHBOARD_METRIC',
      payload: {
        fieldName: matchedField.fieldName,
      },
    };

    return {
      provider: AIProvider.MOCK,
      success: true,
      intent: 'SET_DASHBOARD_METRIC',
      requiresConfirmation: true,
      confirmationToken: serializePendingOperation(operation),
      message: `I can set ${matchedField.displayName} as dashboard metric. Confirm to proceed.`,
      data: {
        fieldName: matchedField.fieldName,
        displayName: matchedField.displayName,
      },
    };
  }

  private async executeConfirmedOperation(token: string): Promise<AIResponse> {
    let operation: PendingOperation;
    try {
      operation = deserializePendingOperation(token);
    } catch {
      return {
        provider: AIProvider.MOCK,
        success: false,
        message: 'Confirmation token is invalid or expired.',
      };
    }

    if (operation.intent === 'ADD_ETF') {
      await this.configService.addMonitoredEtf({
        symbol: operation.payload.symbol,
        name: operation.payload.name,
        isin: operation.payload.isin,
        bvbSymbol: operation.payload.bvbSymbol,
        enabled: true,
      });
    } else if (operation.intent === 'REMOVE_ETF') {
      await this.configService.removeMonitoredEtf(operation.payload.symbol);
    } else if (operation.intent === 'ADD_METRIC') {
      await this.configService.addMonitoredMetric(
        buildMetricDefinitionPayload(operation.payload.field),
      );
    } else if (operation.intent === 'REMOVE_METRIC') {
      await this.configService.removeMonitoredMetric(operation.payload.fieldName);
    } else if (operation.intent === 'SET_DASHBOARD_METRIC') {
      await this.configService.setDashboardMetric(operation.payload.fieldName);
    }

    const snapshot = await this.configService.getConfiguration();
    return {
      provider: AIProvider.MOCK,
      success: true,
      intent: operation.intent,
      message: `${operation.intent} completed successfully.`,
      data: toConfigurationData(
        snapshot.etfs,
        snapshot.fields,
        snapshot.dashboardMetric,
        snapshot.scheduler,
      ),
    };
  }
}
