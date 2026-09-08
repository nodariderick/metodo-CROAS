/**
 * Minimal nodemailer wrapper for transactional emails.
 *
 * Reads SMTP credentials from environment variables:
 *   SMTP_HOST   — mail server hostname (required for sending)
 *   SMTP_PORT   — port, defaults to 587
 *   SMTP_USER   — SMTP username / email address
 *   SMTP_PASS   — SMTP password / app password
 *   SMTP_FROM   — "From" address, e.g. "CROAS <noreply@croas.app>"
 *
 * When SMTP_HOST is absent the mailer falls back to Ethereal (a free
 * catch-all test service) in development, so the server never crashes
 * due to a missing config.
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { logger } from "./logger";

let _transporter: Transporter | null = null;
let _from = "CROAS <noreply@croas.app>";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

/**
 * Returns true when real SMTP credentials are present.
 * Used by callers to decide whether to surface a configuration error.
 */
export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function getTransporter(): Promise<Transporter> {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (from) _from = from;

  if (host && user && pass) {
    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    logger.info({ host, port }, "Mailer: using configured SMTP server");
  } else if (process.env.NODE_ENV !== "production") {
    // Development-only fallback — Ethereal catch-all. Emails are NOT delivered.
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    _from = `CROAS <${testAccount.user}>`;
    logger.warn(
      { previewUrl: "https://ethereal.email" },
      "Mailer: SMTP_HOST not configured — using Ethereal (dev only). Emails are NOT delivered to real inboxes.",
    );
  } else {
    // Production with no SMTP configured — throw so callers can surface a proper error.
    throw new Error(
      "SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment secrets to enable email delivery.",
    );
  }

  return _transporter;
}

export async function sendPasswordResetEmail(
  toEmail: string,
  toName: string,
  resetUrl: string,
): Promise<void> {
  const transporter = await getTransporter();
  const safeName = escapeHtml(toName);
  const safeResetUrl = escapeHtml(resetUrl);

  const info = await transporter.sendMail({
    from: _from,
    to: { name: toName, address: toEmail },
    subject: "Redefinição de senha — CROAS",
    text: [
      `Olá, ${toName}!`,
      "",
      "Recebemos uma solicitação para redefinir a senha da sua conta CROAS.",
      "",
      `Clique no link abaixo para criar uma nova senha (válido por 1 hora):`,
      resetUrl,
      "",
      "Se você não solicitou essa redefinição, pode ignorar este e-mail com segurança.",
      "",
      "— Equipe CROAS",
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;max-width:480px;width:100%;">
        <tr>
          <td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid #222;">
            <span style="font-size:28px;font-weight:700;letter-spacing:0.3em;color:#e8d5b7;font-family:Georgia,serif;">CROAS</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 16px;color:#999;font-size:13px;text-transform:uppercase;letter-spacing:0.15em;">Redefinição de senha</p>
            <p style="margin:0 0 24px;color:#ccc;font-size:15px;line-height:1.6;">Olá, <strong style="color:#e8d5b7;">${safeName}</strong>!</p>
            <p style="margin:0 0 24px;color:#aaa;font-size:14px;line-height:1.7;">
              Recebemos uma solicitação para redefinir a senha da sua conta CROAS.
              Clique no botão abaixo para criar uma nova senha.
              O link é válido por <strong style="color:#ccc;">1 hora</strong>.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:32px auto;">
              <tr>
                <td align="center" style="background:#e8d5b7;">
                  <a href="${safeResetUrl}" style="display:inline-block;padding:14px 32px;color:#111;font-size:13px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;">
                    Redefinir senha
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#555;font-size:12px;line-height:1.6;">
              Ou copie e cole este link no seu navegador:<br>
              <a href="${safeResetUrl}" style="color:#888;word-break:break-all;">${safeResetUrl}</a>
            </p>
            <p style="margin:24px 0 0;color:#555;font-size:12px;">
              Se você não solicitou essa redefinição, pode ignorar este e-mail com segurança.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #222;text-align:center;">
            <p style="margin:0;color:#333;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">
              CROAS // Sistema de Gestão 360
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  // In development with Ethereal, log the preview URL so devs can see the email
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info({ previewUrl }, "Mailer: password reset email preview (Ethereal)");
  } else {
    logger.info({ to: toEmail, messageId: info.messageId }, "Mailer: password reset email sent");
  }
}
