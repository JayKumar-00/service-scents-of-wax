import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  NAME = 'name',
}

export class CategoryQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search term, Ex: category name, slug',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description:
      'Level, Ex: 0 for top-level, 1 for sub-category, 2 for sub-sub-category & so on',
    enum: [0, 1, 2, 3],
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  level?: number;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
