import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listDocuments } from '@/lib/data/activity';
import { listPoles } from '@/lib/data/people';
import { DOCUMENT_CATEGORIES, LABELS } from '@/lib/domain/constants';
import { formatDate } from '@/lib/domain/format';

export const metadata: Metadata = { title: 'Documents' };

function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ categorie?: string; pole?: string; q?: string }> }) {
  await requireSession();
  const params = await searchParams;
  const [documents, poles] = await Promise.all([
    listDocuments({ category: params.categorie, poleId: params.pole, q: params.q }),
    listPoles(),
  ]);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Comptes rendus, procédures, documents de partenariat et ressources de formation. Les fichiers privés sont protégés et téléchargés via un lien temporaire."
        actions={<LinkButton href="/documents/nouveau">Ajouter un document</LinkButton>}
      />

      <form action="/documents" method="get" className="mb-6 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-[var(--c-ink-soft)]">
          Recherche
          <input name="q" defaultValue={params.q ?? ''} className="min-h-9 w-56 rounded-lg border border-[var(--c-line)] bg-[var(--c-surface)] px-2 text-sm" />
        </label>
        <label className="flex flex-col text-xs text-[var(--c-ink-soft)]">
          Catégorie
          <select name="categorie" defaultValue={params.categorie ?? ''} className="min-h-9 rounded-lg border border-[var(--c-line)] bg-[var(--c-surface)] px-2 text-sm">
            <option value="">Toutes</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{LABELS.documentCategory[c]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-[var(--c-ink-soft)]">
          Équipe
          <select name="pole" defaultValue={params.pole ?? ''} className="min-h-9 rounded-lg border border-[var(--c-line)] bg-[var(--c-surface)] px-2 text-sm">
            <option value="">Tous</option>
            {poles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-9 rounded-lg bg-[var(--c-accent)] px-4 text-sm font-medium text-[var(--c-accent-ink)]">Filtrer</button>
      </form>

      {documents.length === 0 ? (
        <EmptyState title="Aucun document ne correspond" text="Ajoutez un compte rendu, une procédure ou un support de présentation." action={<LinkButton href="/documents/nouveau">Ajouter un document</LinkButton>} />
      ) : (
        <ul className="divide-y divide-[var(--c-line)] overflow-hidden rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)]">
          {documents.map((d) => (
            <li key={d.id} className="grid gap-1 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <a href={`/documents/${d.id}`} className="font-medium hover:underline">{d.title}</a>
                <p className="mt-0.5 text-xs text-[var(--c-ink-faint)]">
                  {LABELS.documentCategory[d.category]} · {LABELS.documentVisibility[d.visibility]}
                  {d.pole ? ` · ${d.pole.name}` : ''}
                  {d.project ? ` · Projet : ${d.project.title}` : ''}
                  {' · '}{sizeLabel(d.size_bytes)} · ajouté le {formatDate(d.created_at)}
                  {d.uploader ? ` par ${d.uploader.full_name}` : ''}
                </p>
              </div>
              {d.tags.length > 0 ? <p className="text-xs text-[var(--c-ink-soft)]">{d.tags.map((t) => `#${t}`).join(' ')}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-[var(--c-ink-faint)]">
        <Link href="/parametres" className="hover:underline">Paramètres</Link>
      </p>
    </>
  );
}
