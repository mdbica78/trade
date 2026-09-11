'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type MonitoredEtf = {
  symbol: string;
  enabled: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toMonitoredEtfs(value: unknown): MonitoredEtf[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const symbol = item.symbol;
      const enabled = item.enabled;
      if (typeof symbol !== 'string' || typeof enabled !== 'boolean') {
        return null;
      }

      return { symbol, enabled };
    })
    .filter((item): item is MonitoredEtf => item !== null);
}

function parseJsonPayload(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return [];
  }
}

export default function SettingsPage() {
  const [etfs, setEtfs] = useState<MonitoredEtf[]>([]);
  const [originalState, setOriginalState] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      setError(null);
      let response: Response;
      try {
        response = await fetch('/api/config/etfs', { method: 'GET' });
      } catch {
        setError('Failed to load settings');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError('Failed to load settings');
        setLoading(false);
        return;
      }

      const payload = parseJsonPayload(await response.text());
      const data = toMonitoredEtfs(payload);
      setEtfs(data);
      setOriginalState(
        data.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.symbol] = item.enabled;
          return acc;
        }, {}),
      );

      if (data.length === 0 && Array.isArray(payload) && payload.length > 0) {
        setError('Failed to load settings');
      }

      setLoading(false);
    };

    void loadSettings();
  }, []);

  const toggleEtf = (symbol: string) => {
    setSavedMessage('');
    setEtfs((current) =>
      current.map((item) => (item.symbol === symbol ? { ...item, enabled: !item.enabled } : item)),
    );
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setSavedMessage('');

    try {
      const changedEtfs = etfs.filter((item) => originalState[item.symbol] !== item.enabled);

      await Promise.all(
        changedEtfs.map(async (item) => {
          const response = await fetch('/api/config/etfs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: item.symbol,
              enabled: item.enabled,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to save settings');
          }
        }),
      );

      setOriginalState(
        etfs.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.symbol] = item.enabled;
          return acc;
        }, {}),
      );
      setSavedMessage('Settings saved.');
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-[#0b3a6e] px-6 py-5 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-blue-100">Monitored ETFs</p>
          <nav className="mt-4 flex gap-6 text-sm">
            <Link href="/settings" className="font-semibold text-white underline underline-offset-4">
              ETFs
            </Link>
            <Link href="/settings/fields" className="text-blue-100 hover:text-white">
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
                {etfs.map((item) => (
                  <label
                    key={item.symbol}
                    className="flex items-center gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
                  >
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => toggleEtf(item.symbol)}
                      className="h-4 w-4"
                    />
                    <span>{item.symbol}</span>
                  </label>
                ))}
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
