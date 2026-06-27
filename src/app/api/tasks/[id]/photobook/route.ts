import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Perzistence rozvržení fotoknihy (editor stránek).
 * GET → { doc: BookPage[] | null }   – uložené rozvržení, nebo null když ještě není
 * PUT { doc } → uloží JSON           – lehký zápis bez revalidací/přepočtů (na rozdíl
 *                                       od obecného PATCH /api/tasks/[id])
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id, userId: session.user.id },
    select: { photoBookDoc: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let doc: unknown = null;
  if (task.photoBookDoc) {
    try { doc = JSON.parse(task.photoBookDoc); } catch { doc = null; }
  }
  return NextResponse.json({ doc });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { doc?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

  if (!Array.isArray(body.doc)) return NextResponse.json({ error: "doc must be an array" }, { status: 400 });

  try {
    const res = await prisma.task.updateMany({
      where: { id, userId: session.user.id },
      data: { photoBookDoc: JSON.stringify(body.doc) },
    });
    if (res.count === 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
