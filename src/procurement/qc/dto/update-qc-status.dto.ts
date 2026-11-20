import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { QualityInspectionStatus } from '@prisma/client';

export class UpdateQcStatusDto {
  @ApiProperty({
    description: 'The new status of the quality inspection',
    enum: Object.values(QualityInspectionStatus),
    example: 'PASSED',
  })
  @IsEnum(Object.values(QualityInspectionStatus))
  status!: QualityInspectionStatus;
}
