import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    await prisma.task.delete({
      where: { 
        id: id,
        userId: session.user.id 
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
