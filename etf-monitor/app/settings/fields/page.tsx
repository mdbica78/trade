'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type MonitoredField = {
  fieldName: string;
  displayName: string;
  enabled: boolean;
};

type DashboardMetric = string;

type FieldsConfigResponse = {
  fields: MonitoredField[];
  dashboardMetric: DashboardMetric;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toMonitoredFields(value: unknown): MonitoredField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const fieldName = item.fieldName;
      const displayName = item.displayName;
      const enabled = item.enabled;
      if (
        typeof fieldName !== 'string' ||
        typeof displayName !== 'string' ||
        typeof enabled !== 'boolean'
      ) {
        return null;
      }

      return {
        fieldName,
        displayName,
        enabled,
      };
    })
    .filter((item): item is MonitoredField => item !== null);
}

function parseJsonPayload(text: string): unknown {
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return parseJsonPayload(text);
  } catch {
    return null;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload.error === 'string' && payload.error.trim().length > 0) {
    return payload.error;
  }

  return fallback;
}

function toFieldsConfigResponse(value: unknown): FieldsConfigResponse | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.fields) ||
    typeof value.dashboardMetric !== 'string'
  ) {
    return null;
  }

  return {
    fields: toMonitoredFields(value.fields),
    dashboardMetric: value.dashboardMetric,
  };
}

export default function FieldSettingsPage() {
  const [fields, setFields] = useState<MonitoredField[]>([]);
  const [originalState, setOriginalState] = useState<Record<string, boolean>>({});
  const [dashboardMetric, setDashboardMetric] = useState<DashboardMetric>('units_in_circulation');
  const [originalDashboardMetric, setOriginalDashboardMetric] =
    useState<DashboardMetric>('units_in_circulation');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      setError(null);
      let response: Response;
      let payload: unknown = null;
      try {
        response = await fetch('/api/config/fields', { method: 'GET', cache: 'no-store' });
        payload = await readJsonPayload(response);
      } catch {
        setError('Failed to load settings');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(getErrorMessage(payload, 'Failed to load settings'));
        setLoading(false);
        return;
      }

      const parsedPayload = toFieldsConfigResponse(payload);
      if (!parsedPayload) {
        setError('Failed to load settings');
        setLoading(false);
        return;
      }

      setFields(parsedPayload.fields);
      setOriginalState(
        parsedPayload.fields.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.fieldName] = item.enabled;
          return acc;
        }, {}),
      );
      setDashboardMetric(parsedPayload.dashboardMetric);
      setOriginalDashboardMetric(parsedPayload.dashboardMetric);

      setLoading(false);
    };

    void loadSettings();
  }, []);

  const toggleField = (fieldName: string) => {
    setSavedMessage('');
    setFields((current) =>
      current.map((item) => (item.fieldName === fieldName ? { ...item, enabled: !item.enabled } : item)),
    );
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setSavedMessage('');

    try {
      const changedFields = fields.filter((item) => originalState[item.fieldName] !== item.enabled);
      const metricChanged = dashboardMetric !== originalDashboardMetric;

      await Promise.all(
        changedFields.map(async (item) => {
          const response = await fetch('/api/config/fields', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fieldName: item.fieldName,
              enabled: item.enabled,
            }),
          });

          if (!response.ok) {
            const payload = await readJsonPayload(response);
            throw new Error(getErrorMessage(payload, 'Failed to save settings'));
          }
        }),
      );

      if (metricChanged) {
        const metricResponse = await fetch('/api/config/fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dashboardMetric,
          }),
        });

        if (!metricResponse.ok) {
          const payload = await readJsonPayload(metricResponse);
          throw new Error(getErrorMessage(payload, 'Failed to save settings'));
        }
      }

      setOriginalState(
        fields.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.fieldName] = item.enabled;
          return acc;
        }, {}),
      );
      setOriginalDashboardMetric(dashboardMetric);
      setSavedMessage('Settings saved.');
    } catch (error: unknown) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setError(error.message);
      } else {
        setError('Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-[#0b3a6e] px-6 py-5 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-blue-100">Monitored Fields</p>
          <nav className="mt-4 flex gap-6 text-sm">
            <Link href="/settings" className="text-blue-100 hover:text-white">
              ETFs
            </Link>
            <Link
              href="/settings/fields"
              className="font-semibold text-white underline underline-offset-4"
            >
              Fields
            </Link>
            <Link href="/settings/scheduler" className="text-blue-100 hover:text-white">
              Scheduler
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl justify-center px-4 py-10">
        <section className="w-full max-w-5xl rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {loading ? (
            <p className="text-sm text-slate-700">Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : (
            <>
              <div className="space-y-3">
                {fields.map((item) => (
                  <label
                    key={item.fieldName}
                    className="flex items-center gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
                  >
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => toggleField(item.fieldName)}
                      className="h-4 w-4"
                    />
                    <span>{item.displayName}</span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Select the metrics to collect and store from ETF reports.
              </p>

              <div className="mt-6 rounded border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">Dashboard Metric</p>
                <p className="mt-1 text-sm text-slate-600">
                  Select the metric displayed as the main metric on the dashboard.
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-800">
                  {fields.map((item) => (
                    <label key={`dashboard-metric-${item.fieldName}`} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="dashboard-metric"
                        value={item.fieldName}
                        checked={dashboardMetric === item.fieldName}
                        onChange={() => setDashboardMetric(item.fieldName)}
                        className="h-4 w-4"
                      />
                      <span>{item.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={saving}
                  className="rounded bg-[#0b3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a335f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                {savedMessage ? <p className="text-sm text-green-700">{savedMessage}</p> : null}
              </div>
              <div className="mt-3">
                <Link
                  href="/"
                  className="inline-flex rounded bg-[#0b3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a335f]"
                >
                  Back to Dashboard
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
