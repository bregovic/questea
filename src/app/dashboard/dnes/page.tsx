import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SwipeDeck } from "@/components/SwipeDeck/SwipeDeck";

export const dynamic = "force-dynamic";

export default async function DnesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  // Úkoly k odbavení = mají termín do konce dneška, nejsou hotové ani smazané.
  // Kontejnery/logy (složky, cesty, GPS) sem nepatří.
  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      isDeleted: false,
      status: { not: "DONE" },
      dueDate: { not: null, lte: end },
      taskType: { notIn: ["FOLDER", "LOCATION_HISTORY", "GPS_LOG"] },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      priority: true,
      taskType: true,
      recurrenceType: true,
      recurrenceDay: true,
    },
  });

  const initial = tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
  }));

  return (
    <div className="min-h-screen">
      <h1 className="pt-6 text-center text-lg font-bold text-stone-800">
        Dnes k odbavení
      </h1>
      <SwipeDeck initialTasks={initial} />
    </div>
  );
}
