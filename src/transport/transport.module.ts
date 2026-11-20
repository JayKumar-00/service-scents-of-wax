import { Module } from '@nestjs/common';
import { TransportService } from './transport.service';
import { ShiprocketService } from './shiprocket.service';
import { TransportController } from './transport.controller';
import { ShiprocketProvider } from './providers/shiprocket.provider';
import { GeoModule } from 'src/geo/geo.module';

@Module({
  imports: [GeoModule],
  providers: [TransportService, ShiprocketService, ShiprocketProvider],
  controllers: [TransportController],
})
export class TransportModule {}
