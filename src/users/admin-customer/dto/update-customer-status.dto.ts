import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { CustomerStatus } from '@prisma/client';

export class UpdateCustomerStatusDto {
  @ApiProperty({
    enum: CustomerStatus,
    description:
      'Status to apply to the online customer (e.g., BLOCKED, ACTIVE, INACTIVE, ARCHIVED)',
  })
  @IsEnum(CustomerStatus)
  @IsNotEmpty()
  status!: CustomerStatus;
}
