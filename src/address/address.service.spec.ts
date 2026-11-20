import { Test, TestingModule } from '@nestjs/testing';
import { AddressService } from './address.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { LocationService } from 'src/geo/location.service';
import { ConfigService } from '@nestjs/config';

describe('AddressService', () => {
  let service: AddressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressService,
        { provide: PrismaService, useValue: {} },
        {
          provide: LocationService,
          useValue: {
            geocode: jest
              .fn()
              .mockResolvedValue({ lat: 1, lng: 2, source: 'test' }),
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<AddressService>(AddressService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
