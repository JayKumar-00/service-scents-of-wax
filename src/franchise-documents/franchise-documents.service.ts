import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import {
  franchiseCanMutate,
  franchiseHasReadAccess,
} from '../common/franchise-roles';
import { CreateFranchiseDocumentDto } from './dto/create-franchise-document.dto';

@Injectable()
export class FranchiseDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: JwtUser, franchiseId?: string) {
    if (user.role === Role.SUPERADMIN) {
      const fid = franchiseId?.trim();
      return this.prisma.franchiseDocument.findMany({
        where: fid ? { franchiseId: fid } : undefined,
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: {
          franchise: { select: { id: true, name: true, code: true } },
          uploadedBy: { select: { email: true } },
          verifiedBy: { select: { email: true } },
        },
      });
    }
    if (franchiseHasReadAccess(user.role) && user.franchiseId) {
      return this.prisma.franchiseDocument.findMany({
        where: { franchiseId: user.franchiseId },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          uploadedBy: { select: { email: true } },
          verifiedBy: { select: { email: true } },
        },
      });
    }
    return [];
  }

  async create(dto: CreateFranchiseDocumentDto, user: JwtUser) {
    if (!franchiseCanMutate(user.role) || !user.franchiseId) {
      throw new ForbiddenException();
    }
    return this.prisma.franchiseDocument.create({
      data: {
        franchiseId: user.franchiseId,
        kind: dto.kind,
        title: dto.title.trim(),
        fileUrl: dto.fileUrl.trim(),
        uploadedByUserId: user.sub,
      },
      include: { uploadedBy: { select: { email: true } } },
    });
  }

  async verify(id: string, user: JwtUser) {
    if (user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException();
    }
    const row = await this.prisma.franchiseDocument.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Document not found');
    return this.prisma.franchiseDocument.update({
      where: { id },
      data: { verifiedAt: new Date(), verifiedByUserId: user.sub },
      include: {
        franchise: { select: { id: true, name: true, code: true } },
        verifiedBy: { select: { email: true } },
      },
    });
  }
}
