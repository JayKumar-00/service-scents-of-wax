const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.invoice.updateMany({
    where: { invoiceNumber: { contains: 'GFINO' } },
    data: { isDeleted: true }
  });
  console.log('Soft deleted invoices:', result.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
