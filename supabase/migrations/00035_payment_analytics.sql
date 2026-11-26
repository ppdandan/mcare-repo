-- 00035: Payment analytics from transactions table
-- Provides SQL functions/views for the three payment charts on the analytics dashboard:
--   1. Revenue by service (excluding voided transactions)
--   2. Void rate over time (voided vs total per month)
--   3. Monthly totals (excluding voided)
-- Admin only; the views/functions are called from protected RPCs.

-- Create or replace the public get_transaction_revenue_by_service function
-- Returns total revenue per service, excluding voided transactions (where voided_at IS NOT NULL)
DROP FUNCTION IF EXISTS public.get_transaction_revenue_by_service();
CREATE OR REPLACE FUNCTION public.get_transaction_revenue_by_service()
RETURNS TABLE (
  service_name text,
  revenue numeric(14, 2)
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
SELECT
  COALESCE(s.name, 'General') AS service_name,
  COALESCE(SUM(t.amount), 0) AS revenue
FROM public.transactions t
LEFT JOIN public.appointments a ON t.appointment_id = a.id
LEFT JOIN public.services s ON a.service_id = s.id
WHERE t.voided_at IS NULL  -- exclude voided transactions
GROUP BY s.name
ORDER BY revenue DESC;
$$;

-- Grant execute to authenticated users (the frontend RPC gate controls who can call it)
REVOKE ALL ON FUNCTION public.get_transaction_revenue_by_service() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_transaction_revenue_by_service() TO authenticated;

-- Create or replace the public get_transaction_void_rate_over_time function
-- Returns monthly void rate: (voided_count / total_count) for each month
DROP FUNCTION IF EXISTS public.get_transaction_void_rate_over_time();
CREATE OR REPLACE FUNCTION public.get_transaction_void_rate_over_time()
RETURNS TABLE (
  month_key text,
  total_transactions integer,
  voided_transactions integer,
  void_rate numeric(5, 2)
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
SELECT
  to_char(t.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS month_key,
  COUNT(t.id) AS total_transactions,
  COUNT(t.id) FILTER (WHERE t.voided_at IS NOT NULL) AS voided_transactions,
  -- Compute void rate as a percentage; return 0 if no transactions in the month
  CASE WHEN COUNT(t.id) > 0
    THEN ROUND(100.0 * COUNT(t.id) FILTER (WHERE t.voided_at IS NOT NULL) / COUNT(t.id), 2)
    ELSE 0::numeric(5, 2) END AS void_rate
FROM public.transactions t
GROUP BY to_char(t.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM')
ORDER BY month_key DESC;
$$;

-- Grant execute to authenticated users
REVOKE ALL ON FUNCTION public.get_transaction_void_rate_over_time() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_transaction_void_rate_over_time() TO authenticated;

-- Create or replace the public get_transaction_monthly_totals function
-- Returns monthly total revenue (excluding voided) for the last 12 months
DROP FUNCTION IF EXISTS public.get_transaction_monthly_totals();
CREATE OR REPLACE FUNCTION public.get_transaction_monthly_totals()
RETURNS TABLE (
  month_key text,
  month_label text,
  total_revenue numeric(14, 2)
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
SELECT
  to_char(t.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS month_key,
  to_char(t.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS month_label,
  COALESCE(SUM(t.amount), 0) AS total_revenue
FROM public.transactions t
WHERE t.voided_at IS NULL  -- exclude voided transactions
GROUP BY to_char(t.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM')
ORDER BY month_key DESC
LIMIT 12;
$$;

-- Grant execute to authenticated users
REVOKE ALL ON FUNCTION public.get_transaction_monthly_totals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_transaction_monthly_totals() TO authenticated;

-- Add a view for revenue by service for simpler querying
DROP VIEW IF EXISTS public.revenue_by_service_view;
CREATE VIEW public.revenue_by_service_view AS
SELECT
  COALESCE(s.name, 'General') AS service_name,
  COALESCE(SUM(t.amount), 0) AS revenue
FROM public.transactions t
LEFT JOIN public.appointments a ON t.appointment_id = a.id
LEFT JOIN public.services s ON a.service_id = s.id
WHERE t.voided_at IS NULL
GROUP BY s.name
ORDER BY revenue DESC;