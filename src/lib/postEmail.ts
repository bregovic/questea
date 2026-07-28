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

/**
 * Rozdělení popisu na bloky, mezi které se dají vložit fotky.
 * Primárně podle prázdných řádků; když je text jeden souvislý blok, seká se
 * po dvojicích vět, aby se fotky měly kam vklínit (stejná logika jako na blogu).
 */
function splitIntoBlocks(text: string): string[] {
  const byBlank = text.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);
  if (byBlank.length > 1) return byBlank;
  if (!byBlank.length) return [];

  const sentences = byBlank[0].split(/(?<=[.!?])\s+(?=[A-ZÀ-ſ0-9])/).filter((s) => s.trim());
  if (sentences.length < 4) return byBlank; // krátký text nemá smysl trhat

  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) out.push(sentences.slice(i, i + 2).join(" ").trim());
  return out;
}

function textRow(text: string, lead: boolean): string {
  return `
      <tr><td style="padding:0 0 20px 0;font-size:${lead ? 17 : 16}px;line-height:1.75;color:${lead ? INK : "#3f3a36"};">
        ${esc(text).replace(/\n/g, "<br />")}
      </td></tr>`;
}

function img(url: string, width: number): string {
  return `<img src="${esc(url)}" alt="" width="${width}"
             style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:10px;" />`;
}

/**
 * Fotky ve skupině: jedna přes celou šířku, další se skládají po dvou vedle
 * sebe. Dvousloupec je udělaný tabulkou – v Outlooku je to jediné, co drží.
 */
function photoBlock(urls: string[]): string {
  if (!urls.length) return "";

  const pair = (a: string, b: string) =>
    `<tr><td style="padding:0 0 12px 0;">
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
         <td width="294" style="padding:0 6px 0 0;">${img(a, 294)}</td>
         <td width="294" style="padding:0 0 0 6px;">${img(b, 294)}</td>
       </tr></table>
     </td></tr>`;

  // dvě fotky patří vedle sebe; jinak dostane první plnou šířku jako „hlavní"
  if (urls.length === 2) return pair(urls[0], urls[1]);

  const rows: string[] = [`<tr><td style="padding:0 0 12px 0;">${img(urls[0], 600)}</td></tr>`];
  const rest = urls.slice(1);
  for (let i = 0; i < rest.length; i += 2) {
    const a = rest[i];
    const b = rest[i + 1];
    rows.push(b ? pair(a, b) : `<tr><td style="padding:0 0 12px 0;">${img(a, 600)}</td></tr>`);
  }
  return rows.join("");
}

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

  const paragraphs = splitIntoBlocks(p.description || "");
  const photos = p.photos.slice(0, 12); // víc fotek dělá z mailu neposlatelný kus dat

  /* Text a fotky se prokládají stejně jako na blogu: fotky se rovnoměrně
     rozdělí mezi odstavce, ať e-mail není „zeď textu a pod ní hromada fotek". */
  const perBlock = paragraphs.length ? Math.ceil(photos.length / paragraphs.length) : photos.length;

  const body = paragraphs.length
    ? paragraphs
        .map((text, i) => {
          const lead = i === 0;
          const group = photos.slice(i * perBlock, (i + 1) * perBlock);
          return textRow(text, lead) + photoBlock(group);
        })
        .join("")
    : photoBlock(photos);

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
            ${body}
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
