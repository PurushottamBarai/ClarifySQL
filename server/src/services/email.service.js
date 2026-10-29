function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendContactEmail({ name, email, message }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_RECEIVER_EMAIL || 'snippetvault@onshare.me';
  const from = process.env.RESEND_FROM_EMAIL || 'support@onshare.me';

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message);

  if (!apiKey) {
    console.warn(`[DEV] Contact message from ${name} (${email}):\n${message}`);
    return { success: true, simulated: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `ClarifySQL <${from}>`,
        to: [to],
        reply_to: email,
        subject: `New ClarifySQL Message from ${name.slice(0, 50)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b; border: 1px solid #e4e4e7; border-radius: 8px;">
            <div style="border-bottom: 1px solid #e4e4e7; padding-bottom: 16px; margin-bottom: 16px;">
              <h2 style="font-size: 18px; margin: 0 0 6px 0; color: #0f766e;">New Message via ClarifySQL Contact Form</h2>
              <p style="font-size: 13px; color: #71717a; margin: 0;">Sent on ${new Date().toUTCString()}</p>
            </div>
            <div style="margin-bottom: 16px;">
              <p style="font-size: 14px; margin: 4px 0;"><strong>Sender Name:</strong> ${safeName}</p>
              <p style="font-size: 14px; margin: 4px 0;"><strong>Sender Email:</strong> <a href="mailto:${safeEmail}" style="color: #0f766e;">${safeEmail}</a></p>
            </div>
            <div style="background-color: #f4f4f5; padding: 16px; border-radius: 6px; font-size: 14px; line-height: 1.6; color: #27272a; white-space: pre-wrap; font-family: monospace;">
${safeMessage}
            </div>
            <p style="font-size: 12px; color: #a1a1aa; margin-top: 24px; border-top: 1px solid #f4f4f5; padding-top: 12px;">
              You can hit &quot;Reply&quot; directly in your email client to respond to ${safeEmail}.
            </p>
          </div>
        `
      })
    });
    return { success: res.ok };
  } catch (err) {
    console.error('Contact email sending failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[DEV] Password reset link for ${to}: ${resetUrl}`);
    return { success: true, simulated: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'ClarifySQL <support@onshare.me>',
        to: [to],
        subject: 'Reset your ClarifySQL password',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #18181b;">
            <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px; color: #0f766e;">Reset your password</h2>
            <p style="font-size: 14px; line-height: 1.5; color: #52525b; margin-bottom: 24px;">
              Click the button below to reset your ClarifySQL password. This link will expire in 1 hour.
            </p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #0f766e; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
              Reset Password
            </a>
            <p style="font-size: 12px; color: #a1a1aa; margin-top: 32px;">
              If you did not request a password reset, you can safely ignore this email.
            </p>
          </div>
        `
      })
    });
    return { success: res.ok };
  } catch (err) {
    console.error('Email sending failed:', err.message);
    return { success: false, error: err.message };
  }
}

