import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { GrnStatus } from '@prisma/client';

export class UpdateGrnStatusDto {
  @ApiProperty({
    description: 'The new status of the Goods Receipt Note',
    enum: Object.values(GrnStatus),
    example: 'POSTED',
  })
  @IsEnum(Object.values(GrnStatus))
  status!: GrnStatus;
}
