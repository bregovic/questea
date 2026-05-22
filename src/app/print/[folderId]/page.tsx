import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PrintPageContent } from "./PrintPageContent";

export const dynamic = "force-dynamic";

async function getPrintData(folderId: string) {
  const folder = await prisma.task.findFirst({
    where: { OR: [{ id: folderId }, { slug: folderId }] },
    include: {
      subTasks: {
        where: { isDeleted: false, taskType: { not: "GPS_LOG" } },
        include: {
          locations: true,
          attachments: {
            where: { type: "image" },
            select: { id: true, name: true, type: true, createdAt: true },
          },
        },
        orderBy: { recordedAt: "asc" },
      },
    },
  });

  if (!folder) return null;

  const posts = folder.subTasks.map((post) => ({
    ...post,
    attachments: post.attachments.map((att) => ({
      ...att,
      url: `/api/images/${att.id}`,
    })),
  }));

  return { folder, posts };
}

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: string }>;
  searchParams: Promise<{ format?: string; style?: string }>;
}) {
  const { folderId } = await params;
  const { format = "A4", style = "editorial" } = await searchParams;

  const data = await getPrintData(folderId);
  if (!data) notFound();

  const { folder, posts } = data;

  const startDate =
    posts.length > 0
      ? new Date(posts[0].recordedAt || posts[0].createdAt).toLocaleDateString(
          "cs-CZ",
          { day: "numeric", month: "long", year: "numeric" }
        )
      : "";
  const endDate =
    posts.length > 0
      ? new Date(
          posts[posts.length - 1].recordedAt ||
            posts[posts.length - 1].createdAt
        ).toLocaleDateString("cs-CZ", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

  const latestPrintVersion = await prisma.printVersion.findFirst({
    where: { taskId: folder.id },
    orderBy: { updatedAt: "desc" },
  });

  let dbPages = null;
  let dbFormat = format;
  if (latestPrintVersion) {
    try {
      dbPages = JSON.parse(latestPrintVersion.layout);
      if (latestPrintVersion.format) {
        dbFormat = latestPrintVersion.format;
      }
    } catch (e) {
      console.error("Failed to parse DB layout:", e);
    }
  }

  return (
    <PrintPageContent
      folder={folder}
      posts={posts}
      format={(dbFormat || format) as "A4" | "A5"}
      style={style}
      startDate={startDate}
      endDate={endDate}
      dbPages={dbPages}
    />
  );
}
