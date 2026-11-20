import { Test, TestingModule } from '@nestjs/testing';
import { UserKycController } from './user-kyc.controller';
import { UserKycService } from './user-kyc.service';
import { KycDocumentType } from '@prisma/client';

describe('UserKycController', () => {
  let controller: UserKycController;
  let service: jest.Mocked<UserKycService>;

  const mockUser = {
    sub: 'user123',
    email: 'test@example.com',
    role: 'CUSTOMER',
  } as any;
  const mockIp = '127.0.0.1';

  beforeEach(async () => {
    const mockService = {
      verifyKyc: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserKycController],
      providers: [
        {
          provide: UserKycService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<UserKycController>(UserKycController);
    service = module.get(UserKycService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call verifyKyc', async () => {
    service.verifyKyc.mockResolvedValueOnce({ success: true });
    const dto = {
      id_number: '123456789012',
      isSaveDB: true,
      email: 'test@example.com',
      documentType: KycDocumentType.AADHAAR,
    };
    const res = await controller.verifyKyc(mockUser, dto, mockIp);
    expect(res).toEqual({ success: true });
    expect(service.verifyKyc).toHaveBeenCalledWith(mockUser, dto, mockIp);
  });

  it('should call create', async () => {
    service.create.mockResolvedValueOnce({ id: 'kyc123' } as any);
    const dto = {
      email: 'test@example.com',
      idNumber: '1234',
      status: 'success',
      documentType: KycDocumentType.AADHAAR,
    };
    const res = await controller.create(mockUser, dto, mockIp);
    expect(res).toEqual({ id: 'kyc123' });
    expect(service.create).toHaveBeenCalledWith(mockUser, dto, mockIp);
  });

  it('should call findAll', async () => {
    service.findAll.mockResolvedValueOnce([{ id: 'kyc123' }] as any);
    const res = await controller.findAll();
    expect(res).toEqual([{ id: 'kyc123' }]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should call findOne', async () => {
    service.findOne.mockResolvedValueOnce({ id: 'kyc123' } as any);
    const res = await controller.findOne('kyc123');
    expect(res).toEqual({ id: 'kyc123' });
    expect(service.findOne).toHaveBeenCalledWith('kyc123');
  });

  it('should call findByEmail', async () => {
    service.findByEmail.mockResolvedValueOnce({ id: 'kyc123' } as any);
    const res = await controller.findByEmail('test@example.com');
    expect(res).toEqual({ id: 'kyc123' });
    expect(service.findByEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('should call update', async () => {
    service.update.mockResolvedValueOnce({
      id: 'kyc123',
      status: 'updated',
    } as any);
    const dto = { status: 'updated' };
    const res = await controller.update(mockUser, 'kyc123', dto, mockIp);
    expect(res).toEqual({ id: 'kyc123', status: 'updated' });
    expect(service.update).toHaveBeenCalledWith(
      mockUser,
      'kyc123',
      dto,
      mockIp,
    );
  });

  it('should call remove', async () => {
    service.remove.mockResolvedValueOnce({ id: 'kyc123' } as any);
    const res = await controller.remove(mockUser, 'kyc123', mockIp);
    expect(res).toEqual({ id: 'kyc123' });
    expect(service.remove).toHaveBeenCalledWith(mockUser, 'kyc123', mockIp);
  });
});
