// Téléchargement d'un document privé : vérifie les droits (RLS) puis redirige vers une URL signée de 2 minutes.
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDocumentForDownload } from '@/lib/data/activity';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  if (!session?.profile.is_active || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.redirect(new URL('/connexion', _request.url));
  }

  // La lecture passe par RLS : un document non autorisé n'est pas retourné.
  const doc = await getDocumentForDownload(id);
  if (!doc) {
    return new NextResponse('Document introuvable ou non autorisé.', { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 120);
  if (error || !data) {
    return new NextResponse('Le fichier est temporairement indisponible.', { status: 503 });
  }
  return NextResponse.redirect(data.signedUrl);
}
