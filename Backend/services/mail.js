const nodemailer = require('nodemailer');

// Configure transporter (replace with your SMTP details)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // e.g., 'smtp.gmail.com'
  port: process.env.SMTP_PORT || 587,
  secure: false, // true if port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Send mail function
async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: `"Cookbook_app" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
}

module.exports = sendMail;