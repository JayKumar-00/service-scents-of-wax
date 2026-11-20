import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SurepassProvider } from './providers/surepass.provider';
import { KycDocumentType } from '@prisma/client';
import {
  VerifyUserKycDto,
  CreateUserKycDto,
  UpdateUserKycDto,
} from './dto/user-kyc.dto';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { AuditService } from 'src/audit/audit.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';

@Injectable()
export class UserKycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: SurepassProvider,
    private readonly audit: AuditService,
  ) {}

  async verifyKyc(
    user: JwtUser,
    dto: VerifyUserKycDto,
    ip: string,
  ): Promise<any> {
    let result: any;
    switch (dto.documentType) {
      case KycDocumentType.AADHAAR:
        result = await this.provider.aadhaarValidation(dto.id_number);
        break;
      case KycDocumentType.PAN:
        result = await this.provider.panVerification(dto.id_number);
        break;
      case KycDocumentType.VOTER_ID:
        result = await this.provider.voterIdVerification(dto.id_number);
        break;
      case KycDocumentType.GSTIN:
        result = await this.provider.gstinVerification(dto.id_number);
        break;
      case KycDocumentType.UPI:
        result = await this.provider.upiVerification(dto.id_number);
        break;
      case KycDocumentType.BANK:
        if (!dto.ifsc) {
          throw new BadRequestException(
            'ifsc code is required for BANK verification',
          );
        }
        result = await this.provider.bankVerification(
          dto.id_number,
          dto.ifsc,
          dto.ifsc_details ?? true,
        );
        break;
      case KycDocumentType.DRIVING_LICENSE:
        if (!dto.dob) {
          throw new BadRequestException(
            'dob is required for DRIVING_LICENSE verification',
          );
        }
        result = await this.provider.drivingLicenseVerification(
          dto.id_number,
          dto.dob,
        );
        break;
      case KycDocumentType.PASSPORT:
        result = await this.provider.passportVerification(dto.id_number);
        break;
      default:
        throw new BadRequestException(
          `Verification for document type ${dto.documentType} is not supported.`,
        );
    }

    if (dto.isSaveDB) {
      if (!dto.email) {
        throw new BadRequestException(
          'Email is required when isSaveDB is true',
        );
      }

      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (!user) {
        throw new BadRequestException(`User with email ${dto.email} not found`);
      }

      let kycStatus = 'FAILED';
      if (result.success) {
        kycStatus = result.data?.status || 'SUCCESS';
      }

      await this.prisma.userKyc.upsert({
        where: { userId: user.id },
        update: {
          email: user.email,
          idNumber: dto.id_number,
          status: kycStatus,
          documentType: dto.documentType,
        },
        create: {
          userId: user.id,
          email: user.email,
          idNumber: dto.id_number,
          status: kycStatus,
          documentType: dto.documentType,
        },
      });
    }

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'USER_KYC_VERIFY_UPDATE',
        resource: 'UserKyc',
        resourceId: dto.id_number,
        metadata: {
          idNumber: dto.id_number,
          documentType: dto.documentType,
        },
        ip,
      }),
      'USER_KYC_VERIFY_UPDATE',
    );

    return result;
  }

  async create(actor: JwtUser, dto: CreateUserKycDto, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException(`User with email ${dto.email} not found`);
    }

    const result = await this.prisma.userKyc.upsert({
      where: { userId: user.id },
      update: {
        email: user.email,
        idNumber: dto.idNumber,
        status: dto.status,
        documentType: dto.documentType,
        expiryTime: dto.expiryTime ? new Date(dto.expiryTime) : null,
      },
      create: {
        userId: user.id,
        email: user.email,
        idNumber: dto.idNumber,
        status: dto.status,
        documentType: dto.documentType,
        expiryTime: dto.expiryTime ? new Date(dto.expiryTime) : null,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: actor.sub,
        action: 'USER_KYC_MANUALLY_CREATE',
        resource: 'UserKyc',
        resourceId: dto.idNumber,
        metadata: {
          idNumber: dto.idNumber,
          documentType: dto.documentType,
        },
        ip,
      }),
      'USER_KYC_VERIFY_UPDATE',
    );

    return result;
  }

  async findAll() {
    return this.prisma.userKyc.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.userKyc.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!record) {
      throw new BadRequestException(`User KYC record with ID ${id} not found`);
    }

    return record;
  }

  async findByEmail(email: string) {
    const record = await this.prisma.userKyc.findUnique({
      where: { email },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!record) {
      throw new BadRequestException(
        `User KYC record with email ${email} not found`,
      );
    }

    return record;
  }

  async update(user: JwtUser, id: string, dto: UpdateUserKycDto, ip: string) {
    await this.findOne(id);

    const result = await this.prisma.userKyc.update({
      where: { id },
      data: {
        idNumber: dto.idNumber,
        status: dto.status,
        documentType: dto.documentType,
        expiryTime: dto.expiryTime ? new Date(dto.expiryTime) : undefined,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'USER_KYC_UPDATE',
        resource: 'UserKyc',
        resourceId: result.id,
        metadata: {
          idNumber: dto.idNumber,
          documentType: dto.documentType,
        },
        ip,
      }),
      'USER_KYC_UPDATE',
    );
    return result;
  }

  async remove(user: JwtUser, id: string, ip: string) {
    await this.findOne(id);

    const result = await this.prisma.userKyc.delete({
      where: { id },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'USER_KYC_DELETE',
        resource: 'UserKyc',
        resourceId: result.id,
        metadata: {
          idNumber: result.idNumber,
          documentType: result.documentType,
        },
        ip,
      }),
      'USER_KYC_DELETE',
    );

    return result;
  }
}
