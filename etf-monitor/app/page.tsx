'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type EtfRow = {
  id: number;
  symbol: string;
  report_date: string;
  units_in_circulation: number | null;
  unitsDelta: number | null;
  vuan: number | null;
  net_assets: number | null;
  report_url: string | null;
  created_at: string;
};

export default function Home() {
  const pathname = usePathname();
  const [rows, setRows] = useState<EtfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/history', { method: 'GET' });
        if (!response.ok) {
          throw new Error('Failed to load ETF data');
        }

        const data = (await response.json()) as EtfRow[];
        setRows(data);
        setLastRefresh(new Date().toLocaleString());
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-white">
        <nav className="bg-[#0b3a6e] px-6 py-4 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ETF Monitor
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/"
                className={pathname === '/' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className={
                  pathname === '/settings' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'
                }
              >
                Settings
              </Link>
            </div>
          </div>
        </nav>
        <header className="bg-[#0b3a6e] px-6 py-5 text-white">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-3xl font-semibold tracking-tight">ETF Monitor</h1>
            <p className="mt-1 text-sm text-blue-100">
              Live data extracted automatically from BVB reports
            </p>
          </div>
        </header>
        <div className="mx-auto flex max-w-6xl justify-center px-4 py-10">
          <div className="w-full max-w-5xl rounded-md border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-700">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white">
        <nav className="bg-[#0b3a6e] px-6 py-4 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ETF Monitor
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/"
                className={pathname === '/' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className={
                  pathname === '/settings' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'
                }
              >
                Settings
              </Link>
            </div>
          </div>
        </nav>
        <header className="bg-[#0b3a6e] px-6 py-5 text-white">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-3xl font-semibold tracking-tight">ETF Monitor</h1>
            <p className="mt-1 text-sm text-blue-100">
              Live data extracted automatically from BVB reports
            </p>
          </div>
        </header>
        <div className="mx-auto flex max-w-6xl justify-center px-4 py-10">
          <div className="w-full max-w-5xl rounded-md border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-red-700">
              Failed to load data. Please refresh the page and try again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <nav className="bg-[#0b3a6e] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            ETF Monitor
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/"
              className={pathname === '/' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className={pathname === '/settings' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
            >
              Settings
            </Link>
          </div>
        </div>
      </nav>
      <header className="bg-[#0b3a6e] px-6 py-5 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold tracking-tight">ETF Monitor</h1>
          <p className="mt-1 text-sm text-blue-100">
            Live data extracted automatically from BVB reports
          </p>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl justify-center px-4 py-10">
        <section className="w-full max-w-5xl rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="mb-4 text-sm text-slate-600">Last refresh: {lastRefresh}</p>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-slate-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">ETF</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                    Report Date
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                    Units in Circulation
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                    Δ Units
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">VUAN</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                    Net Assets
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                    Created At
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">PDF</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50`}
                  >
                    <td className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">
                      {row.symbol}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                      {new Date(row.report_date).toLocaleDateString()}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                      {typeof row.units_in_circulation === 'number'
                        ? row.units_in_circulation.toLocaleString()
                        : '-'}
                    </td>
                    <td
                      className={`border-b border-slate-200 px-4 py-3 ${
                        typeof row.unitsDelta === 'number' && row.unitsDelta > 0
                          ? 'text-green-700'
                          : typeof row.unitsDelta === 'number' && row.unitsDelta < 0
                            ? 'text-red-700'
                            : 'text-slate-700'
                      }`}
                    >
                      {row.unitsDelta === null
                        ? '-'
                        : row.unitsDelta > 0
                          ? `+${row.unitsDelta.toLocaleString()}`
                          : row.unitsDelta < 0
                            ? row.unitsDelta.toLocaleString()
                            : '0'}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                      {typeof row.vuan === 'number'
                        ? row.vuan.toLocaleString(undefined, {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3,
                          })
                        : '-'}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                      {typeof row.net_assets === 'number'
                        ? row.net_assets.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '-'}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3">
                      {row.report_url ? (
                        <a
                          href={row.report_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 underline hover:text-blue-900"
                        >
                          Open PDF
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
