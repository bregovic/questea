import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PhotoBook } from "@/components/PhotoBook/PhotoBook";

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
  const { format = "A4" } = await searchParams;

  const data = await getPrintData(folderId);
  if (!data) notFound();

  const { folder, posts } = data;

  return <PhotoBook folder={folder} posts={posts} format={format as "A4" | "A5"} />;
}
