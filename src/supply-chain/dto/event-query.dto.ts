import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
}

export class EventTimeLineQueryDto extends OmitType(QueryDto, [
  'limit',
] as const) {
  @ApiPropertyOptional({
    description: `Search text (eventName), Ex: 'electronics'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: `Search text (eventName), Ex: 'electronics'`,
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description: `Search text (eventName), Ex: 'electronics'`,
  })
  @IsOptional()
  @IsString()
  stockingNodeId?: string;

  @ApiPropertyOptional({
    description: `Search text (eventName), Ex: 'electronics'`,
  })
  @IsOptional()
  @IsString()
  eventName?: string;

  @ApiPropertyOptional({
    description: 'Search text (eventName), Ex: 10',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  taken?: number;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
