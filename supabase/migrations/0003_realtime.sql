-- ACPET Work Portal — enable Realtime on notifications.
--
-- Combined with notifications_select_own's recipient_id = auth.uid() policy
-- (0002), this is what a future client subscription needs to be safe:
--   supabase
--     .channel('notifications')
--     .on('postgres_changes',
--       { event: 'INSERT', schema: 'public', table: 'notifications',
--         filter: `recipient_id=eq.${myUserId}` },
--       (payload) => { /* show the new notification live */ }
--     )
--     .subscribe();
-- Realtime enforces the same RLS policy on the change stream, so a user can
-- only ever subscribe to their own rows. No further schema change is needed
-- later to support live delivery.

alter publication supabase_realtime add table public.notifications;
