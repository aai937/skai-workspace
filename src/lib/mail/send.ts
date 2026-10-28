// Envoi d'e-mails aux membres. Fournisseur choisi par MAIL_PROVIDER : « brevo » (gratuit, sans domaine)
// ou « resend » (gratuit, domaine vérifié requis). Sans configuration, l'envoi est simplement désactivé.
export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type MailResult = { ok: true } | { ok: false; error: string };

export function mailConfigured(): boolean {
  return Boolean(process.env.MAIL_PROVIDER && process.env.MAIL_API_KEY && process.env.MAIL_FROM_EMAIL);
}

function sender() {
  return {
    email: process.env.MAIL_FROM_EMAIL ?? '',
    name: process.env.MAIL_FROM_NAME ?? 'skAI Workspace',
  };
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (!mailConfigured()) {
    return { ok: false, error: 'Envoi d’e-mails non configuré (MAIL_PROVIDER, MAIL_API_KEY, MAIL_FROM_EMAIL).' };
  }
  const provider = process.env.MAIL_PROVIDER;
  const key = process.env.MAIL_API_KEY ?? '';

  try {
    const response =
      provider === 'resend'
        ? await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: `${sender().name} <${sender().email}>`,
              to: [message.to],
              subject: message.subject,
              html: message.html,
              text: message.text,
            }),
          })
        : await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              sender: sender(),
              to: [{ email: message.to }],
              subject: message.subject,
              htmlContent: message.html,
              textContent: message.text,
            }),
          });

    if (!response.ok) {
      // Message générique : le détail du fournisseur peut contenir des informations sensibles.
      return { ok: false, error: `Le fournisseur d’e-mails a refusé l’envoi (code ${response.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Le fournisseur d’e-mails est injoignable.' };
  }
}
