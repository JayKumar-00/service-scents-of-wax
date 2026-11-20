import { Test, TestingModule } from '@nestjs/testing';
import { RecaptchaService } from './recaptcha.service';
import { RecaptchaProvider } from './providers/recaptcha.provider';

describe('RecaptchaService', () => {
  let service: RecaptchaService;
  let mockProvider: { validateToken: jest.Mock };

  beforeEach(async () => {
    mockProvider = {
      validateToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecaptchaService,
        {
          provide: RecaptchaProvider,
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<RecaptchaService>(RecaptchaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateToken', () => {
    it('should return false if token is empty', async () => {
      const result = await service.validateToken('');
      expect(result).toBe(false);
      expect(mockProvider.validateToken).not.toHaveBeenCalled();
    });

    it('should return true if provider verification succeeds', async () => {
      mockProvider.validateToken.mockResolvedValueOnce(true);

      const result = await service.validateToken('valid-token', '127.0.0.1');
      expect(result).toBe(true);
      expect(mockProvider.validateToken).toHaveBeenCalledWith(
        'valid-token',
        '127.0.0.1',
      );
    });

    it('should return false if provider verification fails', async () => {
      mockProvider.validateToken.mockResolvedValueOnce(false);

      const result = await service.validateToken('invalid-token');
      expect(result).toBe(false);
      expect(mockProvider.validateToken).toHaveBeenCalledWith(
        'invalid-token',
        undefined,
      );
    });
  });
});
