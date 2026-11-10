import nodemailer from "nodemailer";

// Works with Gmail (default) or any SMTP service.
// Required: SMTP_USER, SMTP_PASS. Optional: SMTP_HOST, SMTP_PORT, MAIL_FROM.
export function mailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter;
function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

export async function sendVerificationEmail(to, code, minutes = 10) {
  const from = process.env.MAIL_FROM || `Nova <${process.env.SMTP_USER}>`;
  await getTransporter().sendMail({
    from,
    to,
    subject: "Your Nova verification code",
    text:
      `Your Nova verification code is ${code}.\n\n` +
      `It expires in ${minutes} minutes. If you did not create a Nova account, you can ignore this email.`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#171a26">` +
      `<h2 style="margin:0 0 12px">Verify your email</h2>` +
      `<p style="margin:0 0 16px">Use this code to finish creating your Nova account:</p>` +
      `<p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:0 0 16px">${code}</p>` +
      `<p style="color:#6b7084;font-size:14px;margin:0">It expires in ${minutes} minutes. If you did not create a Nova account, you can ignore this email.</p>` +
      `</div>`,
  });
}

export async function sendResetEmail(to, code, minutes = 10) {
  const from = process.env.MAIL_FROM || `Nova <${process.env.SMTP_USER}>`;
  await getTransporter().sendMail({
    from,
    to,
    subject: "Your Nova password reset code",
    text:
      `Your Nova password reset code is ${code}.\n\n` +
      `It expires in ${minutes} minutes. If you did not ask to reset your password, you can ignore this email; your password has not changed.`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#171a26">` +
      `<h2 style="margin:0 0 12px">Reset your password</h2>` +
      `<p style="margin:0 0 16px">Use this code to choose a new Nova password:</p>` +
      `<p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:0 0 16px">${code}</p>` +
      `<p style="color:#6b7084;font-size:14px;margin:0">It expires in ${minutes} minutes. If you did not ask for this, ignore this email; your password has not changed.</p>` +
      `</div>`,
  });
}

export async function sendPasswordChangedEmail(to) {
  const from = process.env.MAIL_FROM || `Nova <${process.env.SMTP_USER}>`;
  await getTransporter().sendMail({
    from,
    to,
    subject: "Your Nova password was changed",
    text:
      "The password of your Nova account was just changed and all other devices were logged out.\n\n" +
      "If this was you, no action is needed. If it was not you, reset your password right away using Forgot password on the login page.",
    html:
      `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#171a26">` +
      `<h2 style="margin:0 0 12px">Your password was changed</h2>` +
      `<p style="margin:0 0 12px">The password of your Nova account was just changed and all other devices were logged out.</p>` +
      `<p style="color:#6b7084;font-size:14px;margin:0">If this was you, no action is needed. If it was not you, use <b>Forgot password</b> on the login page right away.</p>` +
      `</div>`,
  });
}
