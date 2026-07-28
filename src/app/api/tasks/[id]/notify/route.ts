import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail, isConnectionError } from "@/lib/email";
import { renderPostEmail } from "@/lib/postEmail";

/**
 * Ruční rozeslání jednoho příspěvku odběratelům jeho blogu.
 *
 * Odesílá se po jednom a každý pokus se zapíše do PostEmailLog – když jedna
 * adresa selže, ostatní tím netrpí a v detailu je vidět, co se stalo.
 * Rozesílá se jen zveřejněný příspěvek a jen adresám, kterým ještě neodešel
 * (opakované kliknutí tedy nikoho nespamuje; `resend=1` to obejde).
 */

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const resend = new URL(req.url).searchParams.get("resend") === "1";

  const post = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
    include: {
      locations: { orderBy: { createdAt: "desc" } },
      attachments: { select: { id: true, type: true, url: true } },
      parent: { select: { id: true, title: true, slug: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "Příspěvek nenalezen." }, { status: 404 });
  if (post.publishState !== "PUBLISHED")
    return NextResponse.json({ error: "Nejdřív příspěvek zveřejni." }, { status: 400 });
  if (post.isPrivate)
    return NextResponse.json({ error: "Soukromý příspěvek se odběratelům neposílá." }, { status: 400 });

  const blog = post.parent;
  if (!blog) return NextResponse.json({ error: "Příspěvek není v žádném blogu." }, { status: 400 });

  const subs = await prisma.blogSubscriber.findMany({
    where: { blogId: blog.id, unsubscribedAt: null },
  });
  if (!subs.length) return NextResponse.json({ ok: true, sent: 0, message: "Blog zatím nemá odběratele." });

  const already = new Set(
    (await prisma.postEmailLog.findMany({ where: { postId: post.id, ok: true }, select: { email: true } }))
      .map((l) => l.email)
  );
  const targets = resend ? subs : subs.filter((s) => !already.has(s.email));
  if (!targets.length)
    return NextResponse.json({ ok: true, sent: 0, message: "Všem odběratelům už tenhle příspěvek odešel." });

  const base = (process.env.NEXTAUTH_URL || "https://questea.up.railway.app").replace(/\/$/, "");
  const blogUrl = `${base}/blog/${blog.slug || blog.id}`;

  /* Do e-mailu jen absolutní odkazy. Starší přílohy jsou uložené jako base64
     přímo v DB a ty poštovní klienti nezobrazí – ty vynecháme. */
  const photos = post.attachments
    .filter((a) => a.type === "image" && a.url && /^https?:\/\//i.test(a.url))
    .map((a) => a.url as string);

  let sent = 0;
  let aborted: string | null = null;
  const failures: { email: string; error: string }[] = [];

  for (const sub of targets) {
    if (aborted) break; // SMTP je nedostupné – nemá smysl čekat na každou adresu zvlášť
    const mail = renderPostEmail({
      title: post.title,
      description: post.description,
      recordedAt: post.recordedAt,
      createdAt: post.createdAt,
      place: post.locations[0]?.placeName || null,
      photos,
      blogTitle: blog.title,
      blogUrl,
      unsubscribeUrl: `${base}/unsubscribe?token=${sub.token}`,
    });

    try {
      await sendMail({ to: sub.email, subject: mail.subject, html: mail.html, text: mail.text });
      await prisma.postEmailLog.create({ data: { postId: post.id, email: sub.email, ok: true } });
      sent++;
    } catch (e: any) {
      const error = String(e?.message || e).slice(0, 300);
      await prisma.postEmailLog.create({ data: { postId: post.id, email: sub.email, ok: false, error } });
      failures.push({ email: sub.email, error });
      if (isConnectionError(e)) aborted = error;
    }
  }

  if (aborted) {
    return NextResponse.json(
      {
        ok: false,
        sent,
        failed: failures.length,
        error:
          "Server se nedovolal na SMTP (" + aborted + "). Railway blokuje odchozí SMTP – " +
          "e-maily je potřeba posílat přes HTTP API poskytovatele.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed: failures.length,
    failures: failures.slice(0, 5),
    photos: photos.length,
    message: `Odesláno ${sent} z ${targets.length}.`,
  });
}

/** Stav rozeslání pro detail příspěvku. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const post = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
    select: { parentId: true },
  });
  if (!post) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  const [logs, subscribers] = await Promise.all([
    prisma.postEmailLog.findMany({ where: { postId: id }, orderBy: { sentAt: "desc" }, take: 50 }),
    post.parentId
      ? prisma.blogSubscriber.count({ where: { blogId: post.parentId, unsubscribedAt: null } })
      : 0,
  ]);

  return NextResponse.json({
    subscribers,
    sentOk: logs.filter((l) => l.ok).length,
    lastSentAt: logs.find((l) => l.ok)?.sentAt || null,
    logs: logs.map((l) => ({ email: l.email, ok: l.ok, sentAt: l.sentAt, error: l.error })),
  });
}
