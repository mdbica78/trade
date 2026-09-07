'use client';

import { useEffect, useState } from 'react';

type EtfRow = {
  symbol: string;
  reportDate: string;
  unitsInCirculation: number;
  reportUrl: string;
};

export default function Home() {
  const [rows, setRows] = useState<EtfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/etf', { method: 'GET' });
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
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">PDF</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.symbol}-${row.reportDate}`}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50`}
                  >
                    <td className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">
                      {row.symbol}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                      {new Date(row.reportDate).toLocaleDateString()}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                      {row.unitsInCirculation.toLocaleString()}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3">
                      <a
                        href={row.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline hover:text-blue-900"
                      >
                        Open PDF
                      </a>
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
