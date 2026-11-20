import { Test, TestingModule } from '@nestjs/testing';
import { IdentityVerificationService } from './identity-verification.service';
import { SurepassProvider } from './providers/surepass.provider';

describe('IdentityVerificationService', () => {
  let service: IdentityVerificationService;
  let provider: jest.Mocked<SurepassProvider>;

  beforeEach(async () => {
    const mockProvider = {
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
      providers: [
        IdentityVerificationService,
        {
          provide: SurepassProvider,
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<IdentityVerificationService>(
      IdentityVerificationService,
    );
    provider = module.get(SurepassProvider);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delegate panVerification to provider', async () => {
    provider.panVerification.mockResolvedValueOnce({ success: true });
    const res = await service.panVerification('PAN123');
    expect(res).toEqual({ success: true });
    expect(provider.panVerification).toHaveBeenCalledWith('PAN123');
  });

  it('should delegate aadhaarValidation to provider', async () => {
    provider.aadhaarValidation.mockResolvedValueOnce({ success: true });
    const res = await service.aadhaarValidation('AADHAAR123');
    expect(res).toEqual({ success: true });
    expect(provider.aadhaarValidation).toHaveBeenCalledWith('AADHAAR123');
  });

  it('should delegate generateOtp to provider', async () => {
    provider.generateOtp.mockResolvedValueOnce({ success: true });
    const res = await service.generateOtp('AADHAAR123');
    expect(res).toEqual({ success: true });
    expect(provider.generateOtp).toHaveBeenCalledWith('AADHAAR123');
  });

  it('should delegate submitOtp to provider', async () => {
    provider.submitOtp.mockResolvedValueOnce({ success: true });
    const res = await service.submitOtp('client123', 'otp123');
    expect(res).toEqual({ success: true });
    expect(provider.submitOtp).toHaveBeenCalledWith('client123', 'otp123');
  });

  it('should delegate bankVerification to provider', async () => {
    provider.bankVerification.mockResolvedValueOnce({ success: true });
    const res = await service.bankVerification('acc123', 'ifsc123', true);
    expect(res).toEqual({ success: true });
    expect(provider.bankVerification).toHaveBeenCalledWith(
      'acc123',
      'ifsc123',
      true,
    );
  });

  it('should delegate upiVerification to provider', async () => {
    provider.upiVerification.mockResolvedValueOnce({ success: true });
    const res = await service.upiVerification('upi123');
    expect(res).toEqual({ success: true });
    expect(provider.upiVerification).toHaveBeenCalledWith('upi123');
  });

  it('should delegate voterIdVerification to provider', async () => {
    provider.voterIdVerification.mockResolvedValueOnce({ success: true });
    const res = await service.voterIdVerification('voter123');
    expect(res).toEqual({ success: true });
    expect(provider.voterIdVerification).toHaveBeenCalledWith('voter123');
  });

  it('should delegate drivingLicenseVerification to provider', async () => {
    provider.drivingLicenseVerification.mockResolvedValueOnce({
      success: true,
    });
    const res = await service.drivingLicenseVerification('dl123', 'dob123');
    expect(res).toEqual({ success: true });
    expect(provider.drivingLicenseVerification).toHaveBeenCalledWith(
      'dl123',
      'dob123',
    );
  });

  it('should delegate passportVerification to provider', async () => {
    provider.passportVerification.mockResolvedValueOnce({ success: true });
    const res = await service.passportVerification('client123');
    expect(res).toEqual({ success: true });
    expect(provider.passportVerification).toHaveBeenCalledWith('client123');
  });

  it('should delegate gstinVerification to provider', async () => {
    provider.gstinVerification.mockResolvedValueOnce({ success: true });
    const res = await service.gstinVerification('gst123');
    expect(res).toEqual({ success: true });
    expect(provider.gstinVerification).toHaveBeenCalledWith('gst123');
  });

  it('should delegate gstAdvanceVerification to provider', async () => {
    provider.gstAdvanceVerification.mockResolvedValueOnce({ success: true });
    const res = await service.gstAdvanceVerification('gst123');
    expect(res).toEqual({ success: true });
    expect(provider.gstAdvanceVerification).toHaveBeenCalledWith('gst123');
  });

  it('should delegate irnVerification to provider', async () => {
    const fileBuf = Buffer.from('test');
    provider.irnVerification.mockResolvedValueOnce({ success: true });
    const res = await service.irnVerification(
      fileBuf,
      'test.pdf',
      'application/pdf',
      'true',
    );
    expect(res).toEqual({ success: true });
    expect(provider.irnVerification).toHaveBeenCalledWith(
      fileBuf,
      'test.pdf',
      'application/pdf',
      'true',
    );
  });

  it('should delegate faceMatch to provider', async () => {
    const selfieBuf = Buffer.from('selfie');
    const idCardBuf = Buffer.from('id_card');
    provider.faceMatch.mockResolvedValueOnce({ success: true });
    const res = await service.faceMatch(
      selfieBuf,
      'selfie.png',
      'image/png',
      idCardBuf,
      'id_card.png',
      'image/png',
    );
    expect(res).toEqual({ success: true });
    expect(provider.faceMatch).toHaveBeenCalledWith(
      selfieBuf,
      'selfie.png',
      'image/png',
      idCardBuf,
      'id_card.png',
      'image/png',
    );
  });
});
