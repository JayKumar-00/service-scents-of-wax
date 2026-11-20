import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { FranchiseService } from './franchise.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FranchiseService', () => {
  let service: FranchiseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FranchiseService,
        {
          provide: PrismaService,
          useValue: {
            franchise: {
              findMany: jest.fn(),
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FranchiseService>(FranchiseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
