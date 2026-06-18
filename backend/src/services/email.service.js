const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || 'noreply@haa-audit.com';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:4000').replace(/\/$/, '');

function isEmailConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

function buildResetPasswordUrl(token) {
  return `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const subject = 'Reset your HAA Audit Platform password';
  const text = [
    `Hi ${name || 'there'},`,
    '',
    'We received a request to reset your password.',
    'Use the link below to choose a new password (valid for 1 hour):',
    '',
    resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');

  const html = `
    <p>Hi ${name || 'there'},</p>
    <p>We received a request to reset your password.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
  `;

  if (!isEmailConfigured()) {
    logger.warn('SMTP not configured — password reset link logged for development', { to, resetUrl });
    return { sent: false, resetUrl };
  }

  const transport = createTransport();
  await transport.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  return { sent: true, resetUrl };
}

module.exports = {
  FRONTEND_URL,
  isEmailConfigured,
  buildResetPasswordUrl,
  sendPasswordResetEmail,
};
