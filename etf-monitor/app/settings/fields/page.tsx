'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type MonitoredField = {
  fieldName: string;
  displayName: string;
  enabled: boolean;
};

export default function FieldSettingsPage() {
  const [fields, setFields] = useState<MonitoredField[]>([]);
  const [originalState, setOriginalState] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/config/fields', { method: 'GET' });
        if (!response.ok) {
          throw new Error('Failed to load settings');
        }

        const data = (await response.json()) as MonitoredField[];
        setFields(data);
        setOriginalState(
          data.reduce<Record<string, boolean>>((acc, item) => {
            acc[item.fieldName] = item.enabled;
            return acc;
          }, {}),
        );
      } catch {
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
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
            throw new Error('Failed to save settings');
          }
        }),
      );

      setOriginalState(
        fields.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.fieldName] = item.enabled;
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
          <p className="mt-1 text-sm text-blue-100">Monitored Fields</p>
          <nav className="mt-4 flex gap-6 text-sm">
            <Link href="/settings" className="text-blue-100 hover:text-white">
              ETF List
            </Link>
            <Link
              href="/settings/fields"
              className="font-semibold text-white underline underline-offset-4"
            >
              Fields
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
            </>
          )}
        </section>
      </div>
    </main>
  );
}
