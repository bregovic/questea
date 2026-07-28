import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { computeSegment, routeStampOf, haversineKm, TravelMode } from "@/lib/routing";

/**
 * Přepočet vykreslených tras pro celou složku (cestu).
 *
 * Body se berou ve stejném pořadí jako na blogu (chronologicky podle
 * recordedAt/createdAt) a každý úsek se počítá podle travelMode CÍLOVÉHO bodu –
 * tedy „jak jsme se sem dostali z předchozího místa".
 *
 * Je to idempotentní: přepočítá se jen úsek, kterému nesedí otisk vstupů
 * (routeStamp), takže opakované volání nikam neposílá zbytečné dotazy.
 */

const isPoint = (t: any) => t.locations?.[0]?.latitude != null && t.locations?.[0]?.longitude != null;
const timeOf = (t: any) => new Date(t.recordedAt || t.createdAt).getTime();

export async function POST(req: Request, { params }: { params: Promise<{ folderId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { folderId } = await params;

  const folder = await prisma.task.findFirst({
    where: { id: folderId, userId: session.user.id },
    select: { id: true, slug: true, userId: true },
  });
  if (!folder) return NextResponse.json({ error: "Složka nenalezena." }, { status: 404 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const [subTasks, collected] = await Promise.all([
    prisma.task.findMany({
      where: { parentId: folder.id, isDeleted: false, userId: folder.userId },
      include: { locations: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.collectionItem.findMany({
      where: { collectionId: folder.id, post: { isDeleted: false, userId: folder.userId } },
      include: { post: { include: { locations: { orderBy: { createdAt: "desc" } } } } },
    }),
  ]);

  const byId = new Map<string, any>();
  for (const t of [...subTasks, ...collected.map((c) => c.post)]) byId.set(t.id, t);

  /* Stálá základna pro počasí není zastávka na cestě – z řetězu vypadne,
     jinak by se k ní od poslední polohy dopočítávala trasa. Případnou starou
     linku u ní rovnou uklidíme. */
  const all = [...byId.values()].filter(isPoint).sort((a, b) => timeOf(a) - timeOf(b));
  const bases = all.filter((t) => t.isWeatherBase);
  const points = all.filter((t) => !t.isWeatherBase);

  for (const b of bases) {
    if (b.routeGeometry || b.routeStamp) {
      await prisma.task.update({
        where: { id: b.id },
        data: { routeGeometry: null, routeStamp: null, routeDistance: null },
      });
    }
  }

  if (points.length < 2) {
    return NextResponse.json({ ok: true, points: points.length, computed: 0, message: "Málo bodů na trasu." });
  }

  const results: any[] = [];
  let computed = 0;

  // první bod nemá odkud přijet – případnou starou linku uklidíme
  const first = points[0];
  if (first.routeGeometry || first.routeStamp) {
    await prisma.task.update({
      where: { id: first.id },
      data: { routeGeometry: null, routeStamp: null, routeDistance: null },
    });
  }

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const from = { lat: prev.locations[0].latitude, lng: prev.locations[0].longitude };
    const to = { lat: cur.locations[0].latitude, lng: cur.locations[0].longitude };
    const mode = (cur.travelMode || "DIRECT") as TravelMode;
    const stamp = routeStampOf(from, to, mode);

    if (!force && cur.routeStamp === stamp) {
      results.push({ title: cur.title, mode, status: "cached" });
      continue;
    }

    const seg = await computeSegment(from, to, mode);
    computed++;

    await prisma.task.update({
      where: { id: cur.id },
      data: {
        routeGeometry: seg ? JSON.stringify(seg.coords) : null,
        routeDistance: seg ? seg.distanceKm : null,
        routeStamp: stamp, // uložíme i u neúspěchu, ať se to nezkouší dokola
      },
    });

    results.push({
      title: cur.title,
      mode,
      status: seg ? "ok" : "fallback",
      provider: seg?.provider,
      km: seg ? Number(seg.distanceKm.toFixed(1)) : Number(haversineKm(from, to).toFixed(1)),
    });
  }

  revalidatePath(`/blog/${folder.id}`);
  if (folder.slug) revalidatePath(`/blog/${folder.slug}`);

  return NextResponse.json({ ok: true, points: points.length, computed, segments: results });
}
