const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting data cleanup...");

  // 1. Fix task types for legacy subtasks
  // Any task that has a parent and is still LOCATION_HISTORY should be LOCATION
  const subTasks = await prisma.task.updateMany({
    where: {
      parentId: { not: null },
      taskType: "LOCATION_HISTORY"
    },
    data: {
      taskType: "LOCATION"
    }
  });
  console.log(`Updated ${subTasks.count} subtasks to type LOCATION.`);

  // 2. Ensure root journey folders are LOCATION_HISTORY
  const rootJourneys = await prisma.task.updateMany({
    where: {
      parentId: null,
      title: { contains: "202", mode: "insensitive" } // Common naming pattern for trips
    },
    data: {
      taskType: "LOCATION_HISTORY"
    }
  });
  console.log(`Updated ${rootJourneys.count} potential root folders to LOCATION_HISTORY.`);

  // 3. Fix missing blog templates for main folders
  const templates = await prisma.task.updateMany({
    where: {
      taskType: "LOCATION_HISTORY",
      blogTemplate: null
    },
    data: {
      blogTemplate: "MODERN"
    }
  });
  console.log(`Initialized blog template for ${templates.count} folders.`);

  console.log("Cleanup complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
