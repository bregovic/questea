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
        subTasks: {
          include: { category: true },
          orderBy: { orderIndex: "asc" }
        },
        attachments: true,
        locations: {
          orderBy: { createdAt: "desc" }
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
    const { payee, ...rest } = body;

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
        userId: session.user.id,
      },
    });
    return NextResponse.json(task);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
