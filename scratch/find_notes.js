const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { title: { contains: 'Marka', mode: 'insensitive' } },
        { title: { contains: 'San Marco', mode: 'insensitive' } },
        { description: { contains: 'Benát', mode: 'insensitive' } }
      ]
    },
    include: {
      locations: true
    }
  });

  console.log(JSON.stringify(tasks, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
