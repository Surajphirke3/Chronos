import nodemailer from 'nodemailer'

export async function sendInvitationEmail(params: {
  to: string
  organizationName: string
  inviterName: string
  inviteUrl: string
  expiresAt: Date
}): Promise<{ sent: boolean; error?: string }> {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.SMTP_FROM?.trim() || user

  if (!host || !user || !pass || !from) {
    return { sent: false, error: 'Email delivery is not configured (SMTP_* env vars)' }
  }

  try {
    const port = Number(process.env.SMTP_PORT || 587)
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })

    await transporter.sendMail({
      from,
      to: params.to,
      subject: `You're invited to ${params.organizationName} on Chronos`,
      text: [
        `${params.inviterName} invited you to join ${params.organizationName} on Chronos.`,
        '',
        `Accept invitation: ${params.inviteUrl}`,
        `Expires: ${params.expiresAt.toISOString()}`,
        '',
        'If you did not expect this email, you can ignore it.',
      ].join('\n'),
    })

    return { sent: true }
  } catch {
    return { sent: false, error: 'Failed to send invitation email' }
  }
}
