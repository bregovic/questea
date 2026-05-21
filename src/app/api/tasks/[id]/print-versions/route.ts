import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const versions = await prisma.printVersion.findMany({
      where: {
        taskId: id,
        task: { userId: session.user.id }
      },
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Failed to fetch print versions:", error);
    return NextResponse.json({ error: "Failed to fetch print versions" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, layout, format } = body;

    if (!name || !layout) {
      return NextResponse.json({ error: "Name and layout are required" }, { status: 400 });
    }

    // Verify task ownership
    const task = await prisma.task.findFirst({
      where: { id, userId: session.user.id }
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found or access denied" }, { status: 404 });
    }

    // Create or update (upsert) could be nice, or simply save as a new version
    const newVersion = await prisma.printVersion.create({
      data: {
        taskId: id,
        name: name.trim(),
        layout: typeof layout === "string" ? layout : JSON.stringify(layout),
        format: format || "A4"
      }
    });

    return NextResponse.json(newVersion);
  } catch (error) {
    console.error("Failed to save print version:", error);
    return NextResponse.json({ error: "Failed to save print version" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get("versionId");

  if (!versionId) {
    return NextResponse.json({ error: "Version ID is required" }, { status: 400 });
  }

  try {
    // Delete only if it belongs to this task and this user owns the task
    const version = await prisma.printVersion.findFirst({
      where: {
        id: versionId,
        taskId: id,
        task: { userId: session.user.id }
      }
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found or access denied" }, { status: 404 });
    }

    await prisma.printVersion.delete({
      where: { id: versionId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete print version:", error);
    return NextResponse.json({ error: "Failed to delete print version" }, { status: 500 });
  }
}
