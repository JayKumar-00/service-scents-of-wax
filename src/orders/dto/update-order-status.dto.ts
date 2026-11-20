import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: `New status for the order, Ex: ${Object.values(OrderStatus).join(', ')}`,
    enum: OrderStatus,
  })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status!: OrderStatus;
}
