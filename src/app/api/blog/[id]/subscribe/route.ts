import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Přihlášení a odhlášení odběru blogu. Veřejné – volá se z dialogu v hlavičce,
 * kde čtenář není přihlášený.
 *
 * Odpověď je schválně stejná i pro adresu, která odebírá/neodebírá, aby přes
 * tenhle endpoint nešlo zjišťovat, kdo blog odebírá.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function blogOf(folderId: string) {
  return prisma.task.findFirst({ where: { id: folderId }, select: { id: true, title: true } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: folderId } = await params;
  const body = await req.json().catch(() => ({} as any));
  const email = String(body?.email || "").trim().toLowerCase();
  const action = body?.action === "unsubscribe" ? "unsubscribe" : "subscribe";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Zadej platnou e-mailovou adresu." }, { status: 400 });
  }

  const blog = await blogOf(folderId);
  if (!blog) return NextResponse.json({ error: "Blog nenalezen." }, { status: 404 });

  if (action === "unsubscribe") {
    await prisma.blogSubscriber.updateMany({
      where: { blogId: blog.id, email, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });
    return NextResponse.json({ ok: true, message: "Odběr byl zrušen." });
  }

  // Opakované přihlášení dřív odhlášené adresy ji zase aktivuje.
  await prisma.blogSubscriber.upsert({
    where: { blogId_email: { blogId: blog.id, email } },
    update: { unsubscribedAt: null },
    create: { blogId: blog.id, email },
  });

  return NextResponse.json({ ok: true, message: "Hotovo, nové příspěvky ti budou chodit na e-mail." });
}
