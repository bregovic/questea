import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    console.log("Starting data cleanup for user:", session.user.id);

    // 1. Find all folders that are type LOCATION_HISTORY (Journeys)
    const journeys = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        taskType: "LOCATION_HISTORY"
      },
      select: { id: true }
    });

    const journeyIds = journeys.map(j => j.id);

    if (journeyIds.length === 0) {
      return NextResponse.json({ message: "No journey folders found." });
    }

    // 2. Update all children of these folders to be type LOCATION if they are not already
    // (We exclude tasks that might be explicitly marked as EXPENSE or TASK if the user wants to keep them, 
    // but usually in a journey folder, they are stops).
    // The user specifically asked to fix "sub-records of Journey Folder to be locations".
    const result = await prisma.task.updateMany({
      where: {
        userId: session.user.id,
        parentId: { in: journeyIds },
        NOT: {
          taskType: { in: ["LOCATION", "EXPENSE", "GPS_LOG"] } // Don't overwrite expenses or already fixed ones
        }
      },
      data: {
        taskType: "LOCATION"
      }
    });

    return NextResponse.json({ 
      message: "Cleanup successful", 
      updatedCount: result.count,
      journeysFound: journeyIds.length
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json({ error: "Failed to perform cleanup" }, { status: 500 });
  }
}
