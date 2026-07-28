import nodemailer from "nodemailer";

/* POZOR: fallbacky níž jsou leaknuté přihlašovací údaje z gitu. V Railway
   nejsou SMTP_* proměnné nastavené, takže produkce jede právě na nich –
   proto je tu zatím nechávám, aby se odesílání nerozbilo. Až budou proměnné
   nastavené a heslo přerotované, fallbacky odsud i z auth.ts pryč. */
function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    auth: {
      user: process.env.SMTP_USER || "ja.nepalalate@gmail.com",
      pass: process.env.SMTP_PASS || "dyaangpuyukbkbgb",
    },
    tls: { rejectUnauthorized: false },
    /* Bez těchhle limitů čeká nodemailer na spojení dvě minuty. Railway
       odchozí SMTP blokuje, takže se na ně čeká vždycky – radši ať to
       selže rychle a s jasnou hláškou. */
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  });
}

/** Chyba spojení = SMTP je nedostupné, nemá smysl zkoušet další adresy. */
export function isConnectionError(e: any): boolean {
  const s = String(e?.message || e).toLowerCase();
  return (
    ["etimedoutgs", "etimedout", "econnrefused", "econnreset", "ehostunreach", "enetunreach", "esocket"].some((c) =>
      String(e?.code || "").toLowerCase().includes(c)
    ) || /connection timeout|greeting never received|timed out|socket close/.test(s)
  );
}

export function mailFrom() {
  return `"Questea" <${process.env.SMTP_FROM || process.env.SMTP_USER || "ja.nepalalate@gmail.com"}>`;
}

/**
 * Obecné odeslání. Vyhodí výjimku, volající si ji zaloguje ke konkrétní adrese.
 *
 * Railway blokuje odchozí SMTP, takže na produkci se posílá přes Resend (HTTPS,
 * to blokované není). SMTP zůstává jako záloha pro lokální vývoj, kde funguje.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Např. List-Unsubscribe – ať pošta pozná legitimní hromadnou zprávu. */
  headers?: Record<string, string>;
}) {
  const key = process.env.RESEND_API_KEY;

  if (key) {
    const { Resend } = await import("resend");
    const { data, error } = await new Resend(key).emails.send({
      from: process.env.EMAIL_FROM || "Questea <blog@hollyhop.cz>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
      headers: opts.headers,
    });
    if (error) throw new Error(error.message || String(error));
    return data;
  }

  const result = await transport().sendMail({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
    headers: opts.headers,
    from: mailFrom(),
  });
  const failed = result.rejected.concat(result.pending).filter(Boolean);
  if (failed.length) throw new Error(`Nedoručeno: ${failed.join(", ")}`);
  return result;
}

export async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  provider: any;
}) {
  const { identifier, url, provider } = params;
  const { host } = new URL(url);

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

  // přes stejnou cestu jako zbytek pošty – na Railway tedy přes Resend,
  // jinak by přihlašovací odkaz nedorazil (SMTP je odtud nedostupné)
  await sendMail({
    to: identifier,
    subject: `Přihlášení do aplikace Questea`,
    text: `Přihlaste se do aplikace Questea zkopírováním tohoto odkazu: ${url}`,
    html: HTML,
  });
}
