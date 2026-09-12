'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type AISettingsPayload = {
  provider: string;
  model: string;
  configured: boolean;
  status: 'configured' | 'unavailable' | 'connection_error';
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStatus(value: unknown): AISettingsPayload['status'] | null {
  if (value === 'configured' || value === 'unavailable' || value === 'connection_error') {
    return value;
  }
  return null;
}

function toAISettingsPayload(value: unknown): AISettingsPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = toStatus(value.status);
  if (
    !status ||
    typeof value.provider !== 'string' ||
    typeof value.model !== 'string' ||
    typeof value.configured !== 'boolean' ||
    typeof value.message !== 'string'
  ) {
    return null;
  }

  return {
    provider: value.provider,
    model: value.model,
    configured: value.configured,
    status,
    message: value.message,
  };
}

function statusClass(status: AISettingsPayload['status']): string {
  if (status === 'configured') {
    return 'text-green-700';
  }
  if (status === 'unavailable') {
    return 'text-amber-700';
  }
  return 'text-red-700';
}

export default function AISettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AISettingsPayload | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const response = await fetch('/api/config/ai', { method: 'GET', cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load AI settings');
        }

        const payload = (await response.json()) as unknown;
        const parsed = toAISettingsPayload(payload);
        if (!parsed) {
          throw new Error('Invalid AI settings payload');
        }

        setSettings(parsed);
      } catch {
        setError('Failed to load AI settings');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-[#0b3a6e] px-6 py-5 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-blue-100">AI Provider</p>
          <nav className="mt-4 flex gap-6 text-sm">
            <Link href="/settings" className="text-blue-100 hover:text-white">
              ETFs
            </Link>
            <Link href="/settings/fields" className="text-blue-100 hover:text-white">
              Fields
            </Link>
            <Link href="/settings/scheduler" className="text-blue-100 hover:text-white">
              Scheduler
            </Link>
            <Link
              href="/settings/ai"
              className="font-semibold text-white underline underline-offset-4"
            >
              AI
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl justify-center px-4 py-10">
        <section className="w-full max-w-5xl rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {loading ? <p className="text-sm text-slate-700">Loading...</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          {!loading && !error && settings ? (
            <>
              <div className="space-y-3">
                <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Provider</p>
                  <p className="mt-1 text-sm text-slate-900">{settings.provider}</p>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Model</p>
                  <p className="mt-1 text-sm text-slate-900">{settings.model}</p>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
                  <p className={`mt-1 text-sm font-medium ${statusClass(settings.status)}`}>{settings.status}</p>
                  <p className="mt-1 text-sm text-slate-700">{settings.message}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/ai/chat"
                  className="rounded bg-[#0b3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a335f]"
                >
                  Open AI Assistant
                </Link>
                <Link
                  href="/"
                  className="rounded bg-[#0b3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a335f]"
                >
                  Back to Dashboard
                </Link>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
