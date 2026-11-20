import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { GeoRoutingService } from './geo-routing.service';
import { LocationService } from './location.service';

@Module({
  controllers: [GeoController],
  providers: [GeoRoutingService, LocationService],
  exports: [GeoRoutingService, LocationService],
})
export class GeoModule {}
