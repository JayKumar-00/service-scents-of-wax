import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import { GeoRoutingService } from './geo-routing.service';
import { ServiceabilityDto } from './dto/serviceability.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocationService } from './location.service';
import { GeocodeDto } from './dto/geo-code.dto';
import { buildAddressString } from './utils/build-address';

@ApiTags('Geolocation <-> Outlets')
@Controller('geo')
export class GeoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoRoutingService,
    private readonly locationService: LocationService,
    private readonly config: ConfigService,
  ) {}

  /** Whether coordinates are within delivery radius of the nearest active outlet. */
  @Public()
  @Post('serviceability')
  @ApiOperation({
    summary: 'Check if a location is serviceable based on proximity to outlets',
  })
  async serviceability(@Body() dto: ServiceabilityDto) {
    const franchises = await this.prisma.franchise.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        status: true,
        name: true,
        code: true,
      },
    });
    const nearest = this.geo.pickNearestFranchise(dto.lat, dto.lng, franchises);
    const envKm = Number(
      this.config.get<string>('MAX_DELIVERY_RADIUS_KM') ?? '',
    );
    const defaultMax = Number.isFinite(envKm) && envKm > 0 ? envKm : 120;
    const maxK = dto.maxRadiusKm ?? defaultMax;
    if (!nearest || nearest.distanceKm > maxK) {
      return {
        serviceable: false,
        maxRadiusKm: maxK,
        nearestOutlet: nearest
          ? { distanceKm: nearest.distanceKm, franchiseId: nearest.franchiseId }
          : null,
      };
    }
    const outlet = franchises.find((f) => f.id === nearest.franchiseId);
    return {
      serviceable: true,
      maxRadiusKm: maxK,
      nearestOutlet: outlet
        ? {
            franchiseId: outlet.id,
            name: outlet.name,
            code: outlet.code,
            distanceKm: nearest.distanceKm,
          }
        : { franchiseId: nearest.franchiseId, distanceKm: nearest.distanceKm },
    };
  }

  @Post('geocode')
  @ApiOperation({
    summary: 'Geocode an address to get its latitude and longitude',
  })
  @Public()
  async geocode(@Body() dto: GeocodeDto) {
    const address = buildAddressString(dto);

    if (!address) {
      throw new BadRequestException('At least one address field is required');
    }

    return this.locationService.geocode(address);
  }
}
