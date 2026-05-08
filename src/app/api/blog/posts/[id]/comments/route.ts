import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Fetch comments
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const comments = await prisma.postComment.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: {
            name: true,
            image: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });
    return NextResponse.json(comments);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// Post a comment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const { content } = await req.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    let userId = null;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email }
      });
      if (user) userId = user.id;
    }

    const comment = await prisma.postComment.create({
      data: {
        taskId: id,
        userId: userId,
        content: content
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            image: true
          }
        }
      }
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Comment error:", error);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
