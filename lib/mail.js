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
