import { Test, TestingModule } from '@nestjs/testing';
import { IdentityVerificationController } from './identity-verification.controller';
import { IdentityVerificationService } from './identity-verification.service';
import { BadRequestException } from '@nestjs/common';

describe('IdentityVerificationController', () => {
  let controller: IdentityVerificationController;
  let service: jest.Mocked<IdentityVerificationService>;

  beforeEach(async () => {
    const mockService = {
      panVerification: jest.fn(),
      aadhaarValidation: jest.fn(),
      generateOtp: jest.fn(),
      submitOtp: jest.fn(),
      bankVerification: jest.fn(),
      upiVerification: jest.fn(),
      voterIdVerification: jest.fn(),
      drivingLicenseVerification: jest.fn(),
      passportVerification: jest.fn(),
      gstinVerification: jest.fn(),
      gstAdvanceVerification: jest.fn(),
      irnVerification: jest.fn(),
      faceMatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IdentityVerificationController],
      providers: [
        {
          provide: IdentityVerificationService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<IdentityVerificationController>(
      IdentityVerificationController,
    );
    service = module.get(IdentityVerificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call panVerification service method', async () => {
    service.panVerification.mockResolvedValueOnce({ success: true });
    const res = await controller.panVerification({ id_number: 'PAN123' });
    expect(res).toEqual({ success: true });
    expect(service.panVerification).toHaveBeenCalledWith('PAN123');
  });

  it('should call aadhaarValidation service method', async () => {
    service.aadhaarValidation.mockResolvedValueOnce({ success: true });
    const res = await controller.aadhaarValidation({ id_number: 'AADHAAR123' });
    expect(res).toEqual({ success: true });
    expect(service.aadhaarValidation).toHaveBeenCalledWith('AADHAAR123');
  });

  it('should call generateOtp service method', async () => {
    service.generateOtp.mockResolvedValueOnce({ success: true });
    const res = await controller.generateOtp({ id_number: 'AADHAAR123' });
    expect(res).toEqual({ success: true });
    expect(service.generateOtp).toHaveBeenCalledWith('AADHAAR123');
  });

  it('should call submitOtp service method', async () => {
    service.submitOtp.mockResolvedValueOnce({ success: true });
    const res = await controller.submitOtp({
      client_id: 'client123',
      otp: 'otp123',
    });
    expect(res).toEqual({ success: true });
    expect(service.submitOtp).toHaveBeenCalledWith('client123', 'otp123');
  });

  it('should call bankVerification service method', async () => {
    service.bankVerification.mockResolvedValueOnce({ success: true });
    const res = await controller.bankVerification({
      id_number: 'acc123',
      ifsc: 'ifsc123',
      ifsc_details: true,
    });
    expect(res).toEqual({ success: true });
    expect(service.bankVerification).toHaveBeenCalledWith(
      'acc123',
      'ifsc123',
      true,
    );
  });

  it('should call upiVerification service method', async () => {
    service.upiVerification.mockResolvedValueOnce({ success: true });
    const res = await controller.upiVerification({ upi_id: 'upi123' });
    expect(res).toEqual({ success: true });
    expect(service.upiVerification).toHaveBeenCalledWith('upi123');
  });

  it('should call voterIdVerification service method', async () => {
    service.voterIdVerification.mockResolvedValueOnce({ success: true });
    const res = await controller.voterIdVerification({ id_number: 'voter123' });
    expect(res).toEqual({ success: true });
    expect(service.voterIdVerification).toHaveBeenCalledWith('voter123');
  });

  it('should call drivingLicenseVerification service method', async () => {
    service.drivingLicenseVerification.mockResolvedValueOnce({ success: true });
    const res = await controller.drivingLicenseVerification({
      id_number: 'dl123',
      dob: 'dob123',
    });
    expect(res).toEqual({ success: true });
    expect(service.drivingLicenseVerification).toHaveBeenCalledWith(
      'dl123',
      'dob123',
    );
  });

  it('should call passportVerification service method', async () => {
    service.passportVerification.mockResolvedValueOnce({ success: true });
    const res = await controller.passportVerification({
      client_id: 'client123',
    });
    expect(res).toEqual({ success: true });
    expect(service.passportVerification).toHaveBeenCalledWith('client123');
  });

  it('should call gstinVerification service method', async () => {
    service.gstinVerification.mockResolvedValueOnce({ success: true });
    const res = await controller.gstinVerification({ id_number: 'gst123' });
    expect(res).toEqual({ success: true });
    expect(service.gstinVerification).toHaveBeenCalledWith('gst123');
  });

  it('should call gstAdvanceVerification service method', async () => {
    service.gstAdvanceVerification.mockResolvedValueOnce({ success: true });
    const res = await controller.gstAdvanceVerification({
      id_number: 'gst123',
    });
    expect(res).toEqual({ success: true });
    expect(service.gstAdvanceVerification).toHaveBeenCalledWith('gst123');
  });

  it('should call irnVerification service method with file', async () => {
    const file = {
      buffer: Buffer.from('test'),
      originalname: 'invoice.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    service.irnVerification.mockResolvedValueOnce({ success: true });
    const res = await controller.irnVerification(file, {
      use_pdf: 'true',
    } as any);
    expect(res).toEqual({ success: true });
    expect(service.irnVerification).toHaveBeenCalledWith(
      file.buffer,
      file.originalname,
      file.mimetype,
      'true',
    );
  });

  it('should throw BadRequestException if file is missing in irnVerification', () => {
    expect(() =>
      controller.irnVerification(undefined as any, { use_pdf: 'true' } as any),
    ).toThrow(BadRequestException);
  });

  it('should call faceMatch service method with files', async () => {
    const files = {
      selfie: [
        {
          buffer: Buffer.from('selfie'),
          originalname: 'selfie.png',
          mimetype: 'image/png',
        },
      ],
      id_card: [
        {
          buffer: Buffer.from('id_card'),
          originalname: 'id_card.png',
          mimetype: 'image/png',
        },
      ],
    } as any;

    service.faceMatch.mockResolvedValueOnce({ success: true });
    const res = await controller.faceMatch(files, {} as any);
    expect(res).toEqual({ success: true });
    expect(service.faceMatch).toHaveBeenCalledWith(
      files.selfie[0].buffer,
      files.selfie[0].originalname,
      files.selfie[0].mimetype,
      files.id_card[0].buffer,
      files.id_card[0].originalname,
      files.id_card[0].mimetype,
    );
  });

  it('should throw BadRequestException if files are missing in faceMatch', () => {
    expect(() => controller.faceMatch({ selfie: [] }, {} as any)).toThrow(
      BadRequestException,
    );
  });
});
