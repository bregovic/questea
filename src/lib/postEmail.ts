/**
 * HTML příspěvku pro e-mail.
 *
 * Záměrně to nesdílí nic s komponentami blogu: poštovní klienti (Gmail,
 * Outlook) neumí flexbox, grid, CSS proměnné ani externí styly. Proto tabulky,
 * inline styly a šířka 600 px. Barvy jsou vytažené z tématu blogu, ať to působí
 * jako stejná věc.
 */

const ACCENT = "#ea580c";
const INK = "#1c1917";
const MUTED = "#78716c";
const PAPER = "#fafaf9";

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

export type PostEmailInput = {
  title: string;
  description?: string | null;
  recordedAt?: Date | string | null;
  createdAt: Date | string;
  place?: string | null;
  /** Absolutní URL fotek. Base64 obrázky sem nepatří – klienti je nezobrazí. */
  photos: string[];
  blogTitle: string;
  blogUrl: string;
  unsubscribeUrl: string;
};

export function renderPostEmail(p: PostEmailInput): { subject: string; html: string; text: string } {
  const date = new Date(p.recordedAt || p.createdAt).toLocaleDateString("cs-CZ", {
    day: "numeric", month: "long", year: "numeric",
  });

  const paragraphs = (p.description || "")
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean);

  const photoRows = p.photos
    .slice(0, 12) // víc fotek dělá z mailu neposlatelný kus dat
    .map(
      (url) => `
      <tr><td style="padding:0 0 12px 0;">
        <img src="${esc(url)}" alt="" width="600"
             style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:10px;" />
      </td></tr>`
    )
    .join("");

  const textBlocks = paragraphs
    .map(
      (t) => `
      <tr><td style="padding:0 0 18px 0;font-size:16px;line-height:1.7;color:${INK};">
        ${esc(t).replace(/\n/g, "<br />")}
      </td></tr>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="cs"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(p.title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

        <tr><td style="padding:28px 32px 0 32px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${ACCENT};">
            ${esc(p.blogTitle)}
          </div>
        </td></tr>

        <tr><td style="padding:14px 32px 0 32px;">
          <h1 style="margin:0;font-size:30px;line-height:1.15;color:${INK};">${esc(p.title)}</h1>
        </td></tr>

        <tr><td style="padding:10px 32px 24px 32px;font-size:12px;color:${MUTED};letter-spacing:1px;text-transform:uppercase;">
          ${esc(date)}${p.place ? " &middot; " + esc(p.place) : ""}
        </td></tr>

        <tr><td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${textBlocks}
            ${photoRows}
          </table>
        </td></tr>

        <tr><td align="center" style="padding:12px 32px 32px 32px;">
          <a href="${esc(p.blogUrl)}"
             style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;
                    font-weight:bold;font-size:14px;padding:13px 26px;border-radius:10px;">
            Otevřít celý blog
          </a>
        </td></tr>

        <tr><td style="padding:20px 32px;background:${PAPER};font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
          Tenhle e-mail ti přišel, protože odebíráš blog ${esc(p.blogTitle)}.<br />
          <a href="${esc(p.unsubscribeUrl)}" style="color:${MUTED};">Odhlásit odběr</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  const text =
    `${p.blogTitle}\n${p.title}\n${date}${p.place ? " · " + p.place : ""}\n\n` +
    paragraphs.join("\n\n") +
    `\n\nCelý blog: ${p.blogUrl}\nOdhlásit odběr: ${p.unsubscribeUrl}\n`;

  return { subject: `${p.blogTitle}: ${p.title}`, html, text };
}
