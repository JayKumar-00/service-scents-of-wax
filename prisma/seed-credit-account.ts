import { CreditAccountStatus, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEN_LAKH = new Prisma.Decimal('1000000.00');

async function main() {
  const franchises = await prisma.franchise.findMany({
    select: { id: true, code: true },
    orderBy: { createdAt: 'asc' },
  });

  if (franchises.length === 0) {
    throw new Error('No franchises found to seed credit accounts.');
  }

  for (const franchise of franchises) {
    const account = await prisma.creditAccount.upsert({
      where: { franchiseId: franchise.id },
      update: {
        advanceBalance: TEN_LAKH,
      },
      create: {
        franchiseId: franchise.id,
        totalCredit: new Prisma.Decimal('0.00'),
        usedCredit: new Prisma.Decimal('0.00'),
        availableCredit: new Prisma.Decimal('0.00'),
        advanceBalance: TEN_LAKH,
        status: CreditAccountStatus.ACTIVE,
        autoPenaltyEnabled: true,
        autoCreditIncreaseEnabled: true,
        autoReminderEnabled: true,
      },
    });

    console.log(
      `Seeded ${franchise.code} (${franchise.id}) advanceBalance=${account.advanceBalance.toString()}`,
    );
  }

  console.log(
    `Completed credit-account seed for ${franchises.length} franchise(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
