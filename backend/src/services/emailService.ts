import { Resend } from 'resend';

// Inițializare lazy — evită crash-ul la pornire dacă cheia lipsește în dev
const getResend = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY lipsește din variabilele de mediu.');
  return new Resend(key);
};

export async function sendPasswordResetEmail(
  email: string,
  otp: string
): Promise<void> {
  const resend = getResend();

  await resend.emails.send({
    from: `Zidario <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'Codul tău de resetare parolă — Zidario',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 32px; background: #ffffff;">
        
        <div style="margin-bottom: 32px;">
          <span style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Zidario</span>
        </div>

        <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 12px;">Resetare parolă</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 32px;">
          Ai solicitat resetarea parolei pentru contul tău Zidario. 
          Introdu codul de mai jos în aplicație. Codul este valabil <strong>15 minute</strong>.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 32px;">
          <p style="color: #64748b; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">Codul tău de verificare</p>
          <span style="font-size: 48px; font-weight: 800; color: #0f172a; letter-spacing: 12px; font-variant-numeric: tabular-nums;">${otp}</span>
        </div>

        <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 24px;">
          Dacă nu ai solicitat tu resetarea parolei, poți ignora acest email în siguranță. 
          Contul tău este protejat și nimeni nu va putea accesa fără a introduce codul.
        </p>
      </div>
    `,
  });
}