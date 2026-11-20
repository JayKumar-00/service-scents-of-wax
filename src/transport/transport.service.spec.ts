import { Test, TestingModule } from '@nestjs/testing';
import { TransportService } from './transport.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ShiprocketService } from './shiprocket.service';
import { AuditService } from 'src/audit/audit.service';

describe('TransportService', () => {
  let service: TransportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransportService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: ShiprocketService,
          useValue: {},
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransportService>(TransportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
