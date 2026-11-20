import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BundleProvisionMethod } from '@prisma/client';

export class AssignBundleDto {
  @ApiProperty({
    description: 'Franchise ID to assign the bundle to',
    example: 'fran-123',
  })
  @IsNotEmpty()
  @IsString()
  franchiseId!: string;

  @ApiPropertyOptional({
    description: 'Method to provision the bundle',
    enum: BundleProvisionMethod,
    default: BundleProvisionMethod.STOCK_REQUEST,
  })
  @IsOptional()
  @IsEnum(BundleProvisionMethod)
  method?: BundleProvisionMethod;
}
