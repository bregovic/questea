import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { recalculateTaskDistances } from "@/lib/odometer";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tasks = await prisma.task.findMany({
      where: { 
        OR: [
          { userId: session.user.id },
          { subTasks: { some: { userId: session.user.id } } }
        ]
      },
      include: { 
        category: true,
        parent: {
          select: { id: true, title: true, parentId: true }
        },
        locations: {
          select: { id: true, latitude: true, longitude: true, address: true, placeName: true, createdAt: true, mileage: true },
          orderBy: { createdAt: "desc" }
        },
        _count: {
          select: { 
            subTasks: true,
            attachments: true 
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    // Nedovol klientovi přepsat vlastníka/id a podstrčit cizí parentId (mass-assignment).
    const { payee, id: _ignoreId, userId: _ignoreUserId, parentId, ...rest } = body;

    // parentId musí patřit přihlášenému uživateli – jinak by záznam spadl pod cizí složku/blog.
    let safeParentId: string | null = null;
    if (parentId) {
      const parent = await prisma.task.findFirst({
        where: { id: parentId, userId: session.user.id },
        select: { id: true },
      });
      if (!parent)
        return NextResponse.json({ error: "Neplatná nadřazená složka." }, { status: 400 });
      safeParentId = parent.id;
    }

    // Pokud je zadán příjemce, přidáme ho do číselníku
    if (payee && payee.trim() !== "") {
      await prisma.payee.upsert({
        where: {
          name_userId: {
            name: payee.trim(),
            userId: session.user.id
          }
        },
        update: {},
        create: {
          name: payee.trim(),
          userId: session.user.id
        }
      });
    }

    const task = await prisma.task.create({
      data: {
        ...rest,
        payee: payee,
        parentId: safeParentId,
        userId: session.user.id,
      },
    });

    // Recalculate distances if part of a journey
    if (task.parentId) {
      await recalculateTaskDistances(task.parentId);
    }

    // Trigger revalidation for the public blog (Hierarchical)
    if (task.id) {
      if (task.slug) revalidatePath(`/blog/${task.slug}`);
      revalidatePath(`/blog/${task.id}`);
      if (task.parentId) {
        const p = await prisma.task.findUnique({
          where: { id: task.parentId },
          select: { id: true, slug: true }
        });
        if (p) {
          if (p.slug) revalidatePath(`/blog/${p.slug}`);
          revalidatePath(`/blog/${p.id}`);
        }
      }
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
