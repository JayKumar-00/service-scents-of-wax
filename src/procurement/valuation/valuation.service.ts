import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ValuationService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.inventoryValuationSnapshot.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
