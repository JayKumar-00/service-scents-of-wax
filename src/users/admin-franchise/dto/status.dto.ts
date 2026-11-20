import { ApiPropertyOptional } from '@nestjs/swagger';
import { FranchiseStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class FranchiseStatusDto {
  @ApiPropertyOptional({
    description: 'Filter by franchise status',
    enum: FranchiseStatus,
  })
  @IsEnum(FranchiseStatus)
  @IsNotEmpty()
  status!: FranchiseStatus;
}
