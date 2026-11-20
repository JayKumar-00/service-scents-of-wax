import { Test, TestingModule } from '@nestjs/testing';
import { AdminFranchiseService } from './admin-franchise.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminFranchiseService', () => {
  let service: AdminFranchiseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminFranchiseService,
        {
          provide: PrismaService,
          useValue: {
            franchise: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AdminFranchiseService>(AdminFranchiseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
