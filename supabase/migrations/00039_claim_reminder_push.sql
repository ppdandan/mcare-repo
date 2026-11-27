CREATE OR REPLACE FUNCTION public.claim_reminder_push(p_notification_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public
AS $$
  WITH claimed AS (
    UPDATE public.notifications SET push_sent_at = clock_timestamp()
    WHERE id = p_notification_id AND reminder_kind IS NOT NULL AND push_sent_at IS NULL
    RETURNING id
  ) SELECT EXISTS (SELECT 1 FROM claimed);
$$;
REVOKE ALL ON FUNCTION public.claim_reminder_push(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reminder_push(uuid) TO service_role;
