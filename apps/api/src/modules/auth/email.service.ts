import { Resend } from 'resend';
import { getConfig } from '../../config/env';

export interface SendResetEmailParams {
  to: string;
  userName: string;
  resetUrl: string;
  companyName: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a password reset email using the official Resend API.
 */
export async function sendPasswordResetEmail(params: SendResetEmailParams): Promise<EmailSendResult> {
  const { to, userName, resetUrl, companyName } = params;
  const config = getConfig();
  const apiKey = config.resend.apiKey || process.env.RESEND_API_KEY;
  const fromEmail = config.resend.fromEmail || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) {
    console.warn(`[Resend Email Service] RESEND_API_KEY is not configured.`);
    console.warn(`[Resend Fallback Link] To: ${to} | Reset URL: ${resetUrl}`);
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured on the server.',
    };
  }

  try {
    const resend = new Resend(apiKey);
    const subject = `Password Reset Request - ${companyName}`;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 32px 16px; color: #0f172a;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 36px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); border: 1px solid #e2e8f0;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="margin: 0; color: #1e3a8a; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">${companyName}</h2>
      <p style="margin: 4px 0 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Secure Password Reset</p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0 24px 0;" />
    
    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-top: 0;">
      Hello <strong>${userName}</strong>,
    </p>
    
    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
      We received a request to reset the password for your account. Click the secure button below to choose a new password:
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);">
        Reset Password
      </a>
    </div>
    
    <p style="font-size: 12px; line-height: 1.6; color: #64748b; margin-bottom: 24px;">
      If the button above does not work, copy and paste this link into your browser:<br />
      <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
    </p>
    
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; font-size: 12px; line-height: 1.5; color: #991b1b;">
      <strong>⚠️ Expiry Notice:</strong> This password reset link will expire in <strong>30 minutes</strong> and can only be used once. If you did not make this request, you can safely ignore this email. Your password will remain unchanged.
    </div>
    
    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0 20px 0;" />
    
    <p style="text-align: center; font-size: 11px; color: #94a3b8; margin: 0;">
      &copy; ${new Date().getFullYear()} ${companyName}. Enterprise Commercial ERP.
    </p>
  </div>
</body>
</html>`;

    const textContent = `Hello ${userName},

We received a request to reset your password for ${companyName}.

To reset your password, visit the link below (valid for 30 minutes):
${resetUrl}

If you did not request a password reset, you can safely ignore this message.

— ${companyName}`;

    // Format sender name properly e.g. "WONARK <onboarding@resend.dev>"
    const sender = fromEmail.includes('<') ? fromEmail : `${companyName} <${fromEmail}>`;

    const { data, error } = await resend.emails.send({
      from: sender,
      to,
      subject,
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error('[Resend Error]', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err: any) {
    console.error('[Resend Exception]', err);
    return {
      success: false,
      error: err.message || 'Unknown Resend error',
    };
  }
}
