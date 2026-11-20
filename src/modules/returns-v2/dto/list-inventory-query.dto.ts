import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from '../../../common/dto/query.dto';
import { DefectiveSource } from '@prisma/client';

export enum InventoryType {
  DEFECTIVE = 'DEFECTIVE',
  BLOCKED = 'BLOCKED',
}

export class ListInventoryQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by inventory type: DEFECTIVE or BLOCKED',
    enum: InventoryType,
    default: InventoryType.DEFECTIVE,
  })
  @IsOptional()
  @IsEnum(InventoryType)
  type?: InventoryType = InventoryType.DEFECTIVE;

  @ApiPropertyOptional({
    description:
      'Search by product name, slug, SKU, attribute summary, or franchise name/code',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filter by franchise ID (only allowed for SUPERADMIN/ADMIN_STAFF)',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by product ID',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filter by variant ID',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by defective source (only applicable when type is DEFECTIVE)',
    enum: DefectiveSource,
  })
  @IsOptional()
  @IsEnum(DefectiveSource)
  source?: DefectiveSource;

  @ApiPropertyOptional({
    description: 'Sort by field (e.g., createdAt, quantity, updatedAt)',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;
}
