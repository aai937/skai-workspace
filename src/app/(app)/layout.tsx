import { Suspense, type ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { requireSession } from '@/lib/auth';
import { countUnreadNotifications } from '@/lib/data/activity';

// Toutes les pages de l'espace privé passent ici : session vérifiée, compte validé.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const unread = await countUnreadNotifications();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Suspense fallback={null}>
        <Sidebar isBureau={session.viewer.isBureau} isSiteAdmin={session.profile.is_site_admin} name={session.profile.full_name} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar session={session} unread={unread} />
        <main id="contenu" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
