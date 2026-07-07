import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/slug";

// POST /api/tasks/[id]/slug – vygeneruje unikátní slug z názvu složky.
// Při kolizi přidá číslo (moje-cesta, moje-cesta-2, moje-cesta-3 …).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, title: true, slug: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const base = slugify(task.title);
  let candidate = base;
  let n = 2;
  // Hledej volný slug (kromě tohoto úkolu).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.task.findFirst({
      where: { slug: candidate, id: { not: task.id } },
      select: { id: true },
    });
    if (!clash) break;
    candidate = `${base}-${n++}`;
    if (n > 999) break;
  }

  await prisma.task.update({ where: { id: task.id }, data: { slug: candidate } });
  revalidatePath("/blog/[id]", "page");
  return NextResponse.json({ slug: candidate });
}
