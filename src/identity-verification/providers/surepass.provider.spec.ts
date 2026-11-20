import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SurepassProvider } from './surepass.provider';
import axios from 'axios';

jest.mock('axios', () => {
  return {
    create: jest.fn().mockReturnValue({
      post: jest.fn(),
    }),
  };
});

describe('SurepassProvider', () => {
  let provider: SurepassProvider;
  let mockAxiosInstance: any;

  beforeEach(async () => {
    mockAxiosInstance = {
      post: jest.fn(),
    };
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurepassProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => {
              if (key === 'SUREPASS_BASE_URL')
                return 'https://sandbox.surepass.io';
              if (key === 'SUREPASS_API_TOKEN') return 'test-token';
              if (key === 'SUREPASS_CLIENT_ID') return 'test-client-id';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<SurepassProvider>(SurepassProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('panVerification', () => {
    it('should post raw payload directly to /api/v1/pan/pan-only', async () => {
      const mockResult = { success: true, data: { full_name: 'John Doe' } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.panVerification('ABCDE1234F');
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/pan/pan-only',
        { id_number: 'ABCDE1234F' },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('aadhaarValidation', () => {
    it('should post raw payload directly to /api/v1/aadhaar-validation/aadhaar-validation', async () => {
      const mockResult = { success: true, data: { status: 'success' } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.aadhaarValidation('123456789012');
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/aadhaar-validation/aadhaar-validation',
        { id_number: '123456789012' },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('generateOtp', () => {
    it('should post raw payload directly to /api/v1/aadhaar-v2/generate-otp', async () => {
      const mockResult = { success: true, data: { otp_sent: true } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.generateOtp('123456789012');
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/aadhaar-v2/generate-otp',
        { id_number: '123456789012' },
        expect.any(Object),
      );
    });
  });

  describe('submitOtp', () => {
    it('should post raw payload directly to /api/v1/aadhaar-v2/submit-otp', async () => {
      const mockResult = { success: true, data: { status: 'verified' } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.submitOtp('client-123', '123456');
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/aadhaar-v2/submit-otp',
        { client_id: 'client-123', otp: '123456' },
        expect.any(Object),
      );
    });
  });

  describe('bankVerification', () => {
    it('should post raw payload directly to /api/v1/bank-verification/', async () => {
      const mockResult = { success: true, data: { account_exists: true } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.bankVerification(
        '1234567890',
        'IFSC0001',
        true,
      );
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/bank-verification/',
        { id_number: '1234567890', ifsc: 'IFSC0001', ifsc_details: true },
        expect.any(Object),
      );
    });
  });

  describe('upiVerification', () => {
    it('should post raw payload directly to /api/v1/bank-verification/upi-verification', async () => {
      const mockResult = { success: true, data: { account_exists: true } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.upiVerification('test@upi');
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/bank-verification/upi-verification',
        { upi_id: 'test@upi' },
        expect.any(Object),
      );
    });
  });

  describe('voterIdVerification', () => {
    it('should post raw payload directly to /api/v1/voter-id/voter-id', async () => {
      const mockResult = { success: true, data: { name: 'VISHAL' } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.voterIdVerification('VOTER123');
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/voter-id/voter-id',
        { id_number: 'VOTER123' },
        expect.any(Object),
      );
    });
  });

  describe('drivingLicenseVerification', () => {
    it('should post raw payload directly to /api/v1/driving-license/driving-license', async () => {
      const mockResult = { success: true, data: { name: 'MUNNA' } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.drivingLicenseVerification(
        'DL123',
        '1998-06-15',
      );
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/driving-license/driving-license',
        { id_number: 'DL123', dob: '1998-06-15' },
        expect.any(Object),
      );
    });
  });

  describe('passportVerification', () => {
    it('should post raw payload directly to /api/v1/passport/passport/verify', async () => {
      const mockResult = { success: true, data: { name: 'MUNNA' } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.passportVerification('client-123');
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/passport/passport/verify',
        { client_id: 'client-123' },
        expect.any(Object),
      );
    });
  });

  describe('gstinVerification', () => {
    it('should post raw payload directly to /api/v1/corporate/gstin', async () => {
      const mockResult = { success: true, data: { gstin: '08AKWP' } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.gstinVerification('GST123');
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/corporate/gstin',
        { id_number: 'GST123' },
        expect.any(Object),
      );
    });
  });

  describe('gstAdvanceVerification', () => {
    it('should post raw payload directly to /api/v1/corporate/gstin-advanced', async () => {
      const mockResult = { success: true, data: { gstin: '08AKWP' } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.gstAdvanceVerification('GST123');
      expect(res).toEqual(mockResult);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/corporate/gstin-advanced',
        { id_number: 'GST123' },
        expect.any(Object),
      );
    });
  });

  describe('irnVerification', () => {
    it('should post multipart/form-data to /api/v1/corporate/einvoice-irn', async () => {
      const mockResult = { success: true, data: { irn_number: 'irn123' } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.irnVerification(
        Buffer.from('test'),
        'test.pdf',
        'application/pdf',
        'true',
      );
      expect(res).toEqual(mockResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/corporate/einvoice-irn',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });
  });

  describe('faceMatch', () => {
    it('should post multipart/form-data to /api/v1/face/face-match', async () => {
      const mockResult = { success: true, data: { confidence: 99 } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const res = await provider.faceMatch(
        Buffer.from('selfie'),
        'selfie.png',
        'image/png',
        Buffer.from('id_card'),
        'id_card.png',
        'image/png',
      );
      expect(res).toEqual(mockResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/face/face-match',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });
  });
});
