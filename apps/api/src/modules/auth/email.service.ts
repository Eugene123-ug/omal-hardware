import { Resend } from 'resend';
import { getConfig } from '../../config/env';

export interface SendResetEmailParams {
  to: string;
  userName?: string;
  resetUrl: string;
  companyName?: string;
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
  const { to, userName = 'Valued User', resetUrl, companyName = 'WONARK' } = params;
  const config = getConfig();
  const apiKey = config.resend.apiKey || process.env.RESEND_API_KEY;
  const fromEmail = config.resend.fromEmail || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) {
    console.warn(`[Resend Email Service] RESEND_API_KEY is not configured.`);
    console.warn(`[Password Reset Fallback URL] To: ${to} | URL: ${resetUrl}`);
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured on the server.',
    };
  }

  try {
    const resend = new Resend(apiKey);
    const subject = `Reset your WONARK password`;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="color: #1e40af; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">${companyName}</h2>
      <p style="margin: 4px 0 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600;">Password Reset</p>
    </div>

    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />

    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-top: 0;">
      Hello <strong>${userName}</strong>,
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #334155;">
      You requested a password reset for your ${companyName} account. Click the button below to set your new password:
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 13px 26px; border-radius: 8px; font-weight: bold; font-size: 14px; text-decoration: none; display: inline-block; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);">
        Reset Password
      </a>
    </div>

    <p style="font-size: 12px; line-height: 1.5; color: #64748b;">
      Or copy and paste this link into your browser:<br />
      <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
    </p>

    <p style="font-size: 12px; line-height: 1.5; color: #b91c1c; background: #fef2f2; padding: 12px; border-radius: 8px; border: 1px solid #fee2e2;">
      <strong>Note:</strong> This link is valid for <strong>1 hour</strong> and can only be used once. If you did not request this, you can safely ignore this email.
    </p>

    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />

    <p style="text-align: center; font-size: 11px; color: #94a3b8; margin: 0;">
      &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
    </p>
  </div>
</body>
</html>`;

    const textContent = `Hello ${userName},

You requested a password reset for your ${companyName} account.

Reset your password using the link below (valid for 1 hour):
${resetUrl}

If you did not request this, please ignore this email.

— ${companyName}`;

    // Sender: e.g. "WONARK <onboarding@resend.dev>" or configured sender
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
