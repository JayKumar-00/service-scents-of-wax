import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PurchaseOrderStatus } from '@prisma/client';

export class UpdatePurchaseOrderStatusDto {
  @ApiProperty({
    description: 'The new status of the Purchase Order',
    enum: Object.values(PurchaseOrderStatus),
    example: 'APPROVED',
  })
  @IsEnum(Object.values(PurchaseOrderStatus))
  status!: PurchaseOrderStatus;
}
