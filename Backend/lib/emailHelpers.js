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

module.exports = createAndSendConfirmation;