// Résultat uniforme des actions serveur : jamais d'exception brute vers l'interface.
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

// Traduit une erreur de base de données en message lisible, sans révéler de détail technique.
export function dbErrorMessage(error: { code?: string; message?: string } | null): string {
  if (!error) {
    return 'Opération impossible.';
  }
  if (error.code === '42501') {
    return "Vous n'avez pas le droit de faire cette action.";
  }
  if (error.code === '23505') {
    return 'Cet élément existe déjà.';
  }
  if (error.code === '23514') {
    return 'Une règle de cohérence empêche cette modification.';
  }
  return "Une erreur est survenue. Réessayez ou prévenez le bureau si le problème persiste.";
}

// Liste les erreurs de validation Zod par champ.
export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || 'form';
    out[key] ??= issue.message;
  }
  return out;
}
