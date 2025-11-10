const crypto = require('crypto');
const sendMail = require('../services/mail'); // your nodemailer wrapper

async function createAndSendConfirmation(client, userId, userEmail) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await client.query(
    `INSERT INTO user_confirmations (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );

  const confirmUrl = `${process.env.APP_URL}/api/auth/confirm?token=${token}`;

  await sendMail({
    to: userEmail,
    subject: 'Confirm your account',
    html: `<p>Please confirm your account by clicking <a href="${confirmUrl}">this link</a>. This link expires in 24 hours.</p>`
  });

  return token;
}

/**
 * Send a suspension notice email.
 * @param {string} to - recipient email
 * @param {string} username - user name for personalization
 * @param {string} duration - suspension duration (e.g., '7 days')
 */
async function sendSuspensionEmail(to, username, duration) {
  const html = `
    <p>Dear ${username},</p>
    <p>Your account has been suspended for ${duration}.</p>
    <p>If you think this is a mistake, contact support.</p>
    <p>Regards,<br/>Team</p>
  `;
  await sendMail({ to, subject: 'Account Suspension Notice', html });
}

/**
 * Send a ban notification email.
 * @param {string} to - recipient email
 * @param {string} username - user name
 */
async function sendBanEmail(to, username) {
  const html = `
    <p>Dear ${username},</p>
    <p>Your account has been permanently banned.</p>
    <p>If you believe this is an error, contact support.</p>
    <p>Regards,<br/>Team</p>
  `;
  await sendMail({ to, subject: 'Account Ban Notice', html });
}

/**
 * Send a newsletter email.
 * @param {string} to - recipient email
 * @param {string} subject - email subject
 * @param {string} content - email HTML content
 */
async function sendNewsletter(to, subject, content) {
  await sendMail({ to, subject, html: content });
}

module.exports = { createAndSendConfirmation, sendSuspensionEmail, sendBanEmail, sendNewsletter };