import nodemailer from "nodemailer";

export async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  provider: any;
}) {
  const { identifier, url, provider } = params;
  const { host } = new URL(url);

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const HTML = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0d1a; color: #e5e1f0; padding: 40px; border-radius: 16px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <!-- Ujistěte se, že máte veřejně dostupné logo nebo tu nechte text -->
    <h1 style="color: #7c3aed; margin: 0;">Questea</h1>
  </div>
  <h2 style="color: #e5e1f0; text-align: center;">Přihlášení do aplikace</h2>
  <p style="text-align: center; color: #9ca3af;">Kliknutím na tlačítko níže se přihlásíte do aplikace Questea.</p>
  <div style="text-align: center; margin: 40px 0;">
    <a href="\${url}" style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
      Přihlásit se
    </a>
  </div>
  <p style="text-align: center; font-size: 13px; color: #9ca3af;">
    Pokud tlačítko nefunguje, zkopírujte a vložte tento odkaz do prohlížeče:<br>
    <a href="\${url}" style="color: #7c3aed; word-break: break-all;">\${url}</a>
  </p>
</div>
  `.replace(/\${url}/g, url);

  const result = await transport.sendMail({
    to: identifier,
    from: `"Questea" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    subject: `Přihlášení do aplikace Questea`,
    text: `Přihlaste se do aplikace Questea zkopírováním tohoto odkazu: ${url}`,
    html: HTML,
  });

  const failed = result.rejected.concat(result.pending).filter(Boolean);
  if (failed.length) {
    throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
  }
}
