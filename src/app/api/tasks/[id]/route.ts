import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { recalculateTaskDistances } from "@/lib/odometer";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const task = await prisma.task.findUnique({
      where: {
        id: id,
        userId: session.user.id
      },
      include: {
        category: true,
        attachments: true,
        locations: {
          orderBy: { createdAt: "desc" }
        },
        subTasks: {
          include: { category: true },
          orderBy: { orderIndex: "asc" }
        }
      }
    });

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const { ownerEmail, payee, ...rest } = body;

    let updateData = { ...rest };

    if (payee !== undefined) {
      updateData.payee = payee;
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
    }

    if (ownerEmail) {
      const targetUser = await prisma.user.findUnique({
        where: { email: ownerEmail }
      });
      if (targetUser) {
        updateData.userId = targetUser.id;
      } else {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }

    const task = await prisma.task.update({
      where: {
        id: id,
        userId: session.user.id
      },
      data: {
        ...updateData, // Use updateData which might include userId from ownerEmail
        // No special logic needed for direct fields like lockStatus, isDeleted
      },
    });

    // Recursive logic: If status became DONE, set all children to DONE
    if (body.status === "DONE") {
      await prisma.task.updateMany({
        where: { parentId: id },
        data: { status: "DONE" }
      });
    }

    // Trigger revalidation for the public blog (Hierarchical)
    const triggerRevalidate = async (tId: string) => {
      const t = await prisma.task.findUnique({ 
        where: { id: tId },
        select: { id: true, slug: true, parentId: true }
      });
      if (!t) return;
      if (t.slug) revalidatePath(`/blog/${t.slug}`);
      revalidatePath(`/blog/${t.id}`);
      if (t.parentId) {
        const p = await prisma.task.findUnique({
          where: { id: t.parentId },
          select: { id: true, slug: true }
        });
        if (p) {
          if (p.slug) revalidatePath(`/blog/${p.slug}`);
          revalidatePath(`/blog/${p.id}`);
        }
      }
    };

    // Recalculate distances if part of a journey
    if (task.parentId) {
      await recalculateTaskDistances(task.parentId);
    }

    await triggerRevalidate(task.id);

    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const task = await prisma.task.findUnique({
      where: { id, userId: session.user.id }
    });

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    await prisma.task.delete({
      where: { id: id },
    });

    // Recalculate distances if part of a journey
    if (task.parentId) {
      await recalculateTaskDistances(task.parentId);
      
      // Revalidate parent blog
      revalidatePath(`/blog/${task.parentId}`);
      const parentTask = await prisma.task.findUnique({ where: { id: task.parentId } });
      if (parentTask?.slug) revalidatePath(`/blog/${parentTask.slug}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
