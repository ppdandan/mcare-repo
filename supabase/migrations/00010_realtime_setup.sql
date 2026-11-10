-- =============================================================================
-- Migration 00010: Enable Supabase Realtime for Appointments and Notifications
-- Allows mobile and web clients to subscribe to real-time changes immediately.
-- =============================================================================

-- Add tables to the supabase_realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

