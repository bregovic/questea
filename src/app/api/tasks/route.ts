import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tasks = await prisma.task.findMany({
      where: { 
        userId: session.user.id,
        parentId: null // Only fetch root tasks originally? Or all and filter?
      },
      include: { 
        category: true,
        subTasks: {
          include: { category: true }
        },
        attachments: true
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
    const task = await prisma.task.create({
      data: {
        ...body,
        userId: session.user.id,
      },
    });
    return NextResponse.json(task);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
