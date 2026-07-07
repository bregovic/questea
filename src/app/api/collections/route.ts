import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

// GET /api/collections?postId=... → kolekce, do kterých příspěvek patří
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const postId = new URL(req.url).searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

  const items = await prisma.collectionItem.findMany({
    where: { postId, collection: { userId: uid } },
    include: { collection: { select: { id: true, title: true, slug: true } } },
  });
  return NextResponse.json(
    items.map((i) => ({
      collectionId: i.collectionId,
      title: i.collection.title,
      slug: i.collection.slug,
    })),
  );
}

// POST { collectionId, postId } → přidat příspěvek do kolekce
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { collectionId, postId } = await req.json();
  if (!collectionId || !postId || collectionId === postId)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Obě položky musí patřit přihlášenému uživateli.
  const count = await prisma.task.count({
    where: { id: { in: [collectionId, postId] }, userId: uid },
  });
  if (count < 2) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.collectionItem.upsert({
    where: { collectionId_postId: { collectionId, postId } },
    update: {},
    create: { collectionId, postId },
  });
  revalidatePath("/blog/[id]", "page");
  return NextResponse.json(item);
}

// DELETE { collectionId, postId } → odebrat příspěvek z kolekce
export async function DELETE(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { collectionId, postId } = await req.json();
  if (!collectionId || !postId)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  await prisma.collectionItem.deleteMany({
    where: { collectionId, postId, collection: { userId: uid } },
  });
  revalidatePath("/blog/[id]", "page");
  return NextResponse.json({ ok: true });
}
