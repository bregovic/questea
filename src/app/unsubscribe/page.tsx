import { prisma } from "@/lib/prisma";

/**
 * Odhlášení jedním kliknutím z e-mailu (odkaz s tokenem).
 * Token je náhodný, takže nikdo neodhlásí cizího odběratele jen podle adresy.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let state: "ok" | "already" | "invalid" = "invalid";
  let blogTitle = "";

  if (token) {
    const sub = await prisma.blogSubscriber.findUnique({
      where: { token },
      include: { blog: { select: { title: true } } },
    });
    if (sub) {
      blogTitle = sub.blog?.title || "";
      if (sub.unsubscribedAt) {
        state = "already";
      } else {
        await prisma.blogSubscriber.update({
          where: { id: sub.id },
          data: { unsubscribedAt: new Date() },
        });
        state = "ok";
      }
    }
  }

  const messages = {
    ok: ["Odběr zrušen", `Už ti nebudou chodit nové příspěvky${blogTitle ? ` z blogu ${blogTitle}` : ""}.`],
    already: ["Už jsi odhlášený", "Tenhle odběr byl zrušený dřív, nic dalšího dělat nemusíš."],
    invalid: ["Odkaz neplatí", "Odhlašovací odkaz je neplatný nebo už byl použit."],
  }[state];

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafaf9", padding: 24, fontFamily: "Outfit, Arial, sans-serif" }}>
      <div style={{ maxWidth: 460, textAlign: "center", background: "#fff", padding: "48px 32px", borderRadius: 20, boxShadow: "0 10px 40px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: "#ea580c", marginBottom: 18 }}>
          Questea
        </div>
        <h1 style={{ margin: "0 0 12px", fontSize: 26, color: "#1c1917" }}>{messages[0]}</h1>
        <p style={{ margin: 0, color: "#78716c", lineHeight: 1.6 }}>{messages[1]}</p>
      </div>
    </div>
  );
}
