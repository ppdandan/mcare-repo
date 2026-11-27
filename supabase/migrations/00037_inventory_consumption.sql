CREATE OR REPLACE FUNCTION public.inventory_consumption(p_start date, p_end date)
RETURNS TABLE (item_id uuid, name text, category text, unit text, total_used bigint, days integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT i.id, i.name, i.category, i.unit, sum(m.quantity), p_end - p_start + 1
  FROM public.stock_movements m
  JOIN public.inventory_items i ON i.id = m.item_id
  WHERE m.movement_type = 'out'
    AND m.created_at >= (p_start::timestamp AT TIME ZONE 'Asia/Manila')
    AND m.created_at < ((p_end + 1)::timestamp AT TIME ZONE 'Asia/Manila')
  GROUP BY i.id
  ORDER BY sum(m.quantity) DESC, i.name, i.id;
$$;
REVOKE ALL ON FUNCTION public.inventory_consumption(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_consumption(date,date) TO authenticated;
