import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// Application privée : chaque rendu dépend de la session de l’utilisateur, rien n’est mis en cache statiquement.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'skAI Workspace', template: '%s · skAI Workspace' },
  description: 'Espace de travail interne de l\'association : tâches, projets, idées, événements et documents.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--c-surface)] focus:px-3 focus:py-2">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
