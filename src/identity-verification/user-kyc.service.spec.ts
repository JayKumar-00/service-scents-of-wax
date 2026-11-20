import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UserKycService } from './user-kyc.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SurepassProvider } from './providers/surepass.provider';
import { KycDocumentType } from '@prisma/client';
import { AuditService } from 'src/audit/audit.service';

describe('UserKycService', () => {
  let service: UserKycService;
  let mockPrisma: any;
  let mockProvider: any;
  let mockAudit: any;

  const mockUser = {
    sub: 'user123',
    email: 'test@example.com',
    role: 'CUSTOMER',
  } as any;
  const mockIp = '127.0.0.1';

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      userKyc: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockProvider = {
      aadhaarValidation: jest.fn(),
      panVerification: jest.fn(),
      bankVerification: jest.fn(),
      drivingLicenseVerification: jest.fn(),
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserKycService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: SurepassProvider,
          useValue: mockProvider,
        },
        {
          provide: AuditService,
          useValue: mockAudit,
        },
      ],
    }).compile();

    service = module.get<UserKycService>(UserKycService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyKyc', () => {
    it('should verify Aadhaar without saving when isSaveDB is false', async () => {
      const mockResult = { success: true, data: { status: 'success' } };
      mockProvider.aadhaarValidation.mockResolvedValueOnce(mockResult);

      const res = await service.verifyKyc(
        mockUser,
        { id_number: '123456789012', documentType: KycDocumentType.AADHAAR },
        mockIp,
      );
      expect(res).toEqual(mockResult);
      expect(mockProvider.aadhaarValidation).toHaveBeenCalledWith(
        '123456789012',
      );
    });

    it('should verify PAN without saving when isSaveDB is false', async () => {
      const mockResult = { success: true, data: { status: 'success' } };
      mockProvider.panVerification.mockResolvedValueOnce(mockResult);

      const res = await service.verifyKyc(
        mockUser,
        { id_number: 'ABCDE1234F', documentType: KycDocumentType.PAN },
        mockIp,
      );
      expect(res).toEqual(mockResult);
      expect(mockProvider.panVerification).toHaveBeenCalledWith('ABCDE1234F');
    });

    it('should verify BANK details with IFSC when isSaveDB is false', async () => {
      const mockResult = { success: true, data: { status: 'success' } };
      mockProvider.bankVerification.mockResolvedValueOnce(mockResult);

      const res = await service.verifyKyc(
        mockUser,
        {
          id_number: '219101000000000',
          documentType: KycDocumentType.BANK,
          ifsc: 'BARB0DAMOHA',
          ifsc_details: true,
        },
        mockIp,
      );
      expect(res).toEqual(mockResult);
      expect(mockProvider.bankVerification).toHaveBeenCalledWith(
        '219101000000000',
        'BARB0DAMOHA',
        true,
      );
    });

    it('should throw BadRequestException if IFSC is missing for BANK verification', async () => {
      await expect(
        service.verifyKyc(
          mockUser,
          { id_number: '219101000000000', documentType: KycDocumentType.BANK },
          mockIp,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify DRIVING_LICENSE with DOB when isSaveDB is false', async () => {
      const mockResult = { success: true, data: { status: 'success' } };
      mockProvider.drivingLicenseVerification.mockResolvedValueOnce(mockResult);

      const res = await service.verifyKyc(
        mockUser,
        {
          id_number: 'DL123',
          documentType: KycDocumentType.DRIVING_LICENSE,
          dob: '1998-06-15',
        },
        mockIp,
      );
      expect(res).toEqual(mockResult);
      expect(mockProvider.drivingLicenseVerification).toHaveBeenCalledWith(
        'DL123',
        '1998-06-15',
      );
    });

    it('should throw BadRequestException if DOB is missing for DRIVING_LICENSE verification', async () => {
      await expect(
        service.verifyKyc(
          mockUser,
          { id_number: 'DL123', documentType: KycDocumentType.DRIVING_LICENSE },
          mockIp,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if email is missing when isSaveDB is true', async () => {
      mockProvider.aadhaarValidation.mockResolvedValueOnce({ success: true });
      await expect(
        service.verifyKyc(
          mockUser,
          {
            id_number: '123456789012',
            documentType: KycDocumentType.AADHAAR,
            isSaveDB: true,
          },
          mockIp,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user is not found when isSaveDB is true', async () => {
      mockProvider.aadhaarValidation.mockResolvedValueOnce({ success: true });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.verifyKyc(
          mockUser,
          {
            id_number: '123456789012',
            documentType: KycDocumentType.AADHAAR,
            isSaveDB: true,
            email: 'test@example.com',
          },
          mockIp,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify Aadhaar and save when isSaveDB is true and user is found', async () => {
      const mockResult = { success: true, data: { status: 'success' } };
      mockProvider.aadhaarValidation.mockResolvedValueOnce(mockResult);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user123',
        email: 'test@example.com',
      });
      mockPrisma.userKyc.upsert.mockResolvedValueOnce({ id: 'kyc123' });

      const res = await service.verifyKyc(
        mockUser,
        {
          id_number: '123456789012',
          documentType: KycDocumentType.AADHAAR,
          isSaveDB: true,
          email: 'test@example.com',
        },
        mockIp,
      );
      expect(res).toEqual(mockResult);
      expect(mockPrisma.userKyc.upsert).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        update: {
          email: 'test@example.com',
          idNumber: '123456789012',
          status: 'success',
          documentType: KycDocumentType.AADHAAR,
        },
        create: {
          userId: 'user123',
          email: 'test@example.com',
          idNumber: '123456789012',
          status: 'success',
          documentType: KycDocumentType.AADHAAR,
        },
      });
    });
  });

  describe('create', () => {
    it('should throw BadRequestException if user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create(
          mockUser,
          {
            email: 'test@example.com',
            idNumber: '1234',
            status: 'success',
            documentType: KycDocumentType.AADHAAR,
          },
          mockIp,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create record if user is found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user123',
        email: 'test@example.com',
      });
      mockPrisma.userKyc.upsert.mockResolvedValueOnce({ id: 'kyc123' });

      const dto = {
        email: 'test@example.com',
        idNumber: '123456789012',
        status: 'success',
        documentType: KycDocumentType.AADHAAR,
        expiryTime: new Date('2030-01-01'),
      };
      const res = await service.create(mockUser, dto, mockIp);
      expect(res).toEqual({ id: 'kyc123' });
      expect(mockPrisma.userKyc.upsert).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        update: {
          email: 'test@example.com',
          idNumber: '123456789012',
          status: 'success',
          documentType: KycDocumentType.AADHAAR,
          expiryTime: new Date('2030-01-01'),
        },
        create: {
          userId: 'user123',
          email: 'test@example.com',
          idNumber: '123456789012',
          status: 'success',
          documentType: KycDocumentType.AADHAAR,
          expiryTime: new Date('2030-01-01'),
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return all records', async () => {
      const mockRecords = [{ id: 'kyc1' }, { id: 'kyc2' }];
      mockPrisma.userKyc.findMany.mockResolvedValueOnce(mockRecords);

      const res = await service.findAll();
      expect(res).toEqual(mockRecords);
      expect(mockPrisma.userKyc.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return record if found', async () => {
      const mockRecord = { id: 'kyc1' };
      mockPrisma.userKyc.findUnique.mockResolvedValueOnce(mockRecord);

      const res = await service.findOne('kyc1');
      expect(res).toEqual(mockRecord);
    });

    it('should throw BadRequestException if not found', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('kyc1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return record if found by email', async () => {
      const mockRecord = { id: 'kyc1', email: 'test@example.com' };
      mockPrisma.userKyc.findUnique.mockResolvedValueOnce(mockRecord);

      const res = await service.findByEmail('test@example.com');
      expect(res).toEqual(mockRecord);
    });

    it('should throw BadRequestException if not found by email', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValueOnce(null);
      await expect(service.findByEmail('test@example.com')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should update record', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValueOnce({ id: 'kyc1' });
      mockPrisma.userKyc.update.mockResolvedValueOnce({
        id: 'kyc1',
        status: 'updated',
      });

      const res = await service.update(
        mockUser,
        'kyc1',
        { status: 'updated' },
        mockIp,
      );
      expect(res).toEqual({ id: 'kyc1', status: 'updated' });
    });
  });

  describe('remove', () => {
    it('should delete record', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValueOnce({ id: 'kyc1' });
      mockPrisma.userKyc.delete.mockResolvedValueOnce({ id: 'kyc1' });

      const res = await service.remove(mockUser, 'kyc1', mockIp);
      expect(res).toEqual({ id: 'kyc1' });
    });
  });
});
