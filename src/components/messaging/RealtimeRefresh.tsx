'use client';

// Temps réel : dès qu'un message ou une réaction change dans ce canal, la page est rafraîchie
// (les données sont relues côté serveur, donc toujours filtrées par RLS).
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/browser';

export function RealtimeRefresh({ channelId }: { channelId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`canal-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId, router]);

  return null;
}
