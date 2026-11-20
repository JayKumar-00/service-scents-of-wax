import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AsnStatus } from '@prisma/client';

export class UpdateAsnStatusDto {
  @ApiProperty({
    description: 'The new status of the Advance Shipping Notice',
    enum: Object.values(AsnStatus),
    example: 'ARRIVED',
  })
  @IsEnum(Object.values(AsnStatus))
  status!: AsnStatus;
}
