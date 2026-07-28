import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Odhlášení jedním klikem pro poštovní klienty (RFC 8058).
 *
 * Gmail a spol. na tenhle odkaz z hlavičky List-Unsubscribe pošlou POST na
 * pozadí, aniž by uživatel opustil schránku. Člověku ukazujeme stránku
 * /unsubscribe, tohle je čistě strojová cesta.
 */
async function unsubscribe(token: string | null) {
  if (!token) return false;
  const sub = await prisma.blogSubscriber.findUnique({ where: { token } });
  if (!sub || sub.unsubscribedAt) return !!sub;
  await prisma.blogSubscriber.update({
    where: { id: sub.id },
    data: { unsubscribedAt: new Date() },
  });
  return true;
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const ok = await unsubscribe(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}

/** Kdyby na odkaz někdo klikl ručně, ať skončí na čitelné stránce. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  await unsubscribe(token);
  return NextResponse.redirect(new URL(`/unsubscribe?token=${token || ""}`, req.url));
}
