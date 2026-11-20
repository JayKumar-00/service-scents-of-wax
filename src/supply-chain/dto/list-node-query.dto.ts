import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockingNodeType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  CODE = 'code',
  NAME = 'name',
  TYPE = 'type',
}

export class ListNodeQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search text (name, franchise.name), Ex: 'electronics'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: `Filter by node type, Ex: 'WAREHOUSE'`,
    enum: StockingNodeType,
  })
  @IsEnum(StockingNodeType)
  @IsOptional()
  type?: StockingNodeType;

  @ApiPropertyOptional({
    description: `Filter by parent node ID, Ex: 'node_12345'`,
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by active (true/false)',
    enum: ['true', 'false'],
  })
  @IsEnum(['true', 'false'])
  @IsOptional()
  active?: ['true', 'false'];

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
