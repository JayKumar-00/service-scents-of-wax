import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PenaltyProcessor {
  constructor(private readonly prisma: PrismaService) {}

  async handle(job: any) {
    const { dueId } = job.data;

    const due = await this.prisma.creditDue.findUnique({
      where: { id: dueId },
    });

    if (!due || due.status !== 'PENDING') {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.creditDue.update({
        where: { id: dueId },
        data: {
          status: 'OVERDUE',
        },
      });

      // future:
      // create CreditTransaction
      // update CreditAccount
    });
  }
}
