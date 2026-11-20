import { forwardRef, Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { ProductsModule } from 'src/products/products.module';
import { AwsS3Provider } from './providers/aws-s3.provider';

@Module({
  imports: [forwardRef(() => ProductsModule)],
  providers: [AwsS3Provider, UploadsService],
  controllers: [UploadsController],
  exports: [UploadsService],
})
export class UploadsModule {}
