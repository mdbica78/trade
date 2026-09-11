'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function SchedulerSettingsPage() {
  const [enabled, setEnabled] = useState(true);
  const [runTime, setRunTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');
  const [runNowMessage, setRunNowMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      setError(null);
      try {
        const response = await fetch('/api/config/scheduler', { method: 'GET' });
        if (!response.ok) {
          throw new Error('Failed to load scheduler settings');
        }

        const settings = (await response.json()) as { enabled: boolean; time: string };
        if (typeof settings.enabled !== 'boolean' || typeof settings.time !== 'string') {
          throw new Error('Invalid scheduler settings');
        }

        setEnabled(settings.enabled);
        setRunTime(settings.time);
      } catch {
        setError('Failed to load scheduler settings');
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const runNow = async () => {
    setError(null);
    setRunNowMessage('');
    setRunningNow(true);

    try {
      const response = await fetch('/api/jobs/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: 'daily-etf-monitor',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run scheduler job');
      }

      setRunNowMessage('Run started.');
    } catch {
      setError('Failed to run scheduler job');
    } finally {
      setRunningNow(false);
    }
  };

  const saveSettings = async () => {
    setError(null);
    setRunNowMessage('');
    setSavedMessage('');
    setSaving(true);

    try {
      const response = await fetch('/api/config/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, time: runTime }),
      });
      if (!response.ok) {
        throw new Error('Failed to save scheduler settings');
      }

      setSavedMessage('Settings saved.');
    } catch {
      setError('Failed to save scheduler settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-[#0b3a6e] px-6 py-5 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-blue-100">Scheduler</p>
          <nav className="mt-4 flex gap-6 text-sm">
            <Link href="/settings" className="text-blue-100 hover:text-white">
              ETFs
            </Link>
            <Link href="/settings/fields" className="text-blue-100 hover:text-white">
              Fields
            </Link>
            <Link
              href="/settings/scheduler"
              className="font-semibold text-white underline underline-offset-4"
            >
              Scheduler
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl justify-center px-4 py-10">
        <section className="w-full max-w-5xl rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {loading ? <p className="mb-4 text-sm text-slate-700">Loading...</p> : null}
          {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                disabled={loading || saving || runningNow}
                className="h-4 w-4"
              />
              <span>Enable Scheduler</span>
            </label>

            <label className="flex items-center gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900">
              <span>Run Time</span>
              <input
                type="time"
                value={runTime}
                onChange={(event) => setRunTime(event.target.value)}
                disabled={loading || saving || runningNow}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={runNow}
              disabled={loading || saving || runningNow}
              className="rounded bg-[#0b3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a335f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runningNow ? 'Running...' : 'Run Now'}
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={loading || saving || runningNow}
              className="rounded bg-[#0b3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a335f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <Link
              href="/"
              className="inline-flex rounded bg-[#0b3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a335f]"
            >
              Back to Dashboard
            </Link>
            {savedMessage ? <p className="text-sm text-green-700">{savedMessage}</p> : null}
            {runNowMessage ? <p className="text-sm text-green-700">{runNowMessage}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
