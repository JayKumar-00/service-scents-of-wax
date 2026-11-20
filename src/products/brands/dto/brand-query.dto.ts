import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum BrandSortBy {
  NAME = 'name',
}

export class BrandQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Search term, Ex: brand name, slug' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: BrandSortBy,
    default: BrandSortBy.NAME,
  })
  @IsOptional()
  @IsEnum(BrandSortBy)
  sortBy: BrandSortBy = BrandSortBy.NAME;
}
