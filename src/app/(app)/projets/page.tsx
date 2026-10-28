import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, LinkButton, PageHeader, ProgressBar } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listProjects } from '@/lib/data/projects';
import { LABELS } from '@/lib/domain/constants';
import { canCreateProject } from '@/lib/domain/permissions';

export const metadata: Metadata = { title: 'Projets' };

export default async function ProjetsPage() {
  const session = await requireSession();
  const isBureau = session.viewer.isBureau;
  const projects = await listProjects();

  return (
    <>
      <PageHeader
        title="Projets"
        description={isBureau ? 'Tous les projets, transversaux ou non. L’avancement se calcule à partir des tâches et jalons terminés.' : 'Les projets de l’association. L’avancement se calcule à partir des tâches et jalons terminés.'}
        actions={canCreateProject(session.viewer) ? <LinkButton href="/projets/nouveau">Nouveau projet</LinkButton> : null}
      />
      {projects.length === 0 ? (
        <EmptyState
          title="Aucun projet pour le moment"
          text="Un projet regroupe des tâches, des jalons, des documents et des membres autour d'un objectif."
          action={canCreateProject(session.viewer) ? <LinkButton href="/projets/nouveau">Créer le premier projet</LinkButton> : undefined}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-5">
              <Link href={`/projets/${p.id}`} className="text-lg font-semibold tracking-tight hover:underline">
                {p.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--c-ink-soft)]">{p.description || 'Pas encore de description.'}</p>
              <p className="mt-3 text-xs text-[var(--c-ink-faint)]">
                {LABELS.projectStatus[p.status]} · {p.project_poles.map((pp) => pp.pole.name).join(' · ') || 'Aucun équipe'}
                {p.lead ? ` · Responsable : ${p.lead.full_name}` : ''}
              </p>
              <div className="mt-4">
                <ProgressBar value={p.progress} label={`Avancement de ${p.title}`} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
