import { IsEnum } from 'class-validator';
import { DeliveryStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDeliveryStatusDto {
  @ApiProperty({
    description: 'The new status of the delivery',
    enum: DeliveryStatus,
    example: DeliveryStatus.IN_TRANSIT,
  })
  @IsEnum(DeliveryStatus)
  status!: DeliveryStatus;
}
