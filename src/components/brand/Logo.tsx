// Identité visuelle de skAI : emblème détouré et wordmark typographique « skAI » en couleur de marque.
// Le nom officiel de l'association n'est pas modifié ; « skAI Workspace » désigne uniquement le logiciel.
import Image from 'next/image';

export function Emblem({ size = 32 }: { size?: number }) {
  return <Image src="/brand/emblem.png" alt="" width={size} height={size} className="shrink-0" aria-hidden="true" />;
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-semibold leading-none tracking-[-0.02em] ${className}`}>
      <span className="text-[var(--c-ink)]">sk</span>
      <span className="text-[var(--c-brand)]">AI</span>
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {compact ? null : <Emblem size={28} />}
      <span className="inline-flex items-baseline gap-2 leading-none">
        <Wordmark className="text-[18px]" />
        <span className="text-[13px] font-medium text-[var(--c-ink-faint)]">Workspace</span>
      </span>
    </span>
  );
}
