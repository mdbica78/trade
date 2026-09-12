WITH inserted_history AS (
    INSERT INTO etf_history (symbol, report_date, report_url, created_at)
    SELECT
        e.symbol,
        to_char(d::date, 'YYYY-MM-DD'),
        'simulation://' || lower(e.symbol) || '/' || to_char(d::date, 'YYYY-MM-DD'),
        to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    FROM (
        VALUES
            ('TVBETETF'),
            ('PTENGETF'),
            ('BTBETRETF'),
            ('BKBETETF'),
            ('GIBEFETF'),
            ('GIBXTETF')
    ) AS e(symbol)
    CROSS JOIN generate_series(
        DATE '2026-09-03',
        DATE '2026-09-09',
        INTERVAL '1 day'
    ) AS d
    ON CONFLICT (symbol, report_date) DO NOTHING
    RETURNING id, symbol, report_date
)
INSERT INTO etf_metrics (history_id, metric_key, metric_value, created_at)
SELECT
    h.id,
    m.metric_key,
    CASE m.metric_key
        WHEN 'units_in_circulation' THEN
            1000000
            + (e.etf_index * 125000)
            + ((h.report_date::date - DATE '2026-09-03') * 15000)

        WHEN 'vuan' THEN
            10.00
            + (e.etf_index * 1.25)
            + ((h.report_date::date - DATE '2026-09-03') * 0.08)

        WHEN 'net_assets' THEN
            15000000
            + (e.etf_index * 3500000)
            + ((h.report_date::date - DATE '2026-09-03') * 275000)
    END,
    to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM inserted_history h
JOIN (
    VALUES
        ('TVBETETF', 0),
        ('PTENGETF', 1),
        ('BTBETRETF', 2),
        ('BKBETETF', 3),
        ('GIBEFETF', 4),
        ('GIBXTETF', 5)
) AS e(symbol, etf_index)
    ON e.symbol = h.symbol
CROSS JOIN (
    VALUES
        ('units_in_circulation'),
        ('vuan'),
        ('net_assets')
) AS m(metric_key)
ON CONFLICT (history_id, metric_key) DO NOTHING;
