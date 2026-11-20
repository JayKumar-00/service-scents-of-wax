import { ApiProperty } from '@nestjs/swagger';
import { FranchiseReturnStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateFranchiseReturnDto {
  @ApiProperty({
    description: 'Updated status of the franchise return',
    enum: FranchiseReturnStatus,
    example: FranchiseReturnStatus.APPROVED,
  })
  @IsEnum(FranchiseReturnStatus)
  status!: FranchiseReturnStatus;

  @ApiProperty({
    description: 'Optional note about the resolution of the return',
    example: 'Return approved after inspection',
  })
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
