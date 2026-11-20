import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockingNodeType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateStockingNodeDto {
  @ApiProperty({
    description: 'Type of the stocking node (e.g., WAREHOUSE, STORE)',
    example: 'WAREHOUSE',
    enum: StockingNodeType,
  })
  @IsEnum(StockingNodeType)
  @IsNotEmpty()
  type!: StockingNodeType;

  @ApiProperty({
    description: 'Name of the stocking node',
    example: 'Main Warehouse',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Unique code for the stocking node',
    example: 'WH_MAIN',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({
    description:
      'Optional ID of the parent stocking node (for hierarchical structures)',
    example: 'node_12345',
  })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({
    description:
      'Optional ID of the franchise associated with this stocking node',
    example: 'franchise_12345',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string | null;

  @ApiPropertyOptional({
    description:
      'Optional sort order for the stocking node (lower numbers appear first)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
