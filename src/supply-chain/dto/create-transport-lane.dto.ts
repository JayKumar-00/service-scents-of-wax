import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTransportLaneDto {
  @ApiProperty({
    description: 'Unique code for the transport lane',
    example: 'LANE_001',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    description: 'Name of the transport lane',
    example: 'Main Route from Warehouse to Store',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'ID of the origin stocking node (e.g., warehouse)',
    example: 'node_12345',
  })
  @IsString()
  @IsNotEmpty()
  originNodeId!: string;

  @ApiProperty({
    description: 'ID of the destination stocking node (e.g., store)',
    example: 'node_67890',
  })
  @IsString()
  @IsNotEmpty()
  destNodeId!: string;

  @ApiPropertyOptional({
    description: 'Optional description or notes about the transport lane',
    example: 'This lane is used for express deliveries.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  defaultSlaHours?: number;

  @ApiPropertyOptional({
    description:
      'Allocation priority for the transport lane (lower numbers are higher priority)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allocationPriority?: number;
}
