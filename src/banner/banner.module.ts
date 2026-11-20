import { Module } from '@nestjs/common';
import { BannerService } from './banner.service';
import { BannerController } from './banner.controller';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  providers: [BannerService],
  controllers: [BannerController],
})
export class BannerModule {}
