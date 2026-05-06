import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const task = await prisma.task.findFirst({
      where: {
        OR: [
          { id },
          { slug: id }
        ]
      }
    });

    if (!task) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        viewCount: {
          increment: 1
        }
      }
    });

    return NextResponse.json({ viewCount: updatedTask.viewCount });
  } catch (error) {
    console.error("Error updating view count:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const task = await prisma.task.findFirst({
      where: {
        OR: [
          { id },
          { slug: id }
        ]
      },
      select: { viewCount: true }
    });

    if (!task) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    return NextResponse.json({ viewCount: task.viewCount });
  } catch (error) {
    console.error("Error fetching view count:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
