import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum MediaSortBy {
  KEY = 'key',
  TAGS = 'tag',
  CREATED_AT = 'createdAt',
  ORIENTATION = 'orientation',
}

export class MediaQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search term, Ex: tag, mimeType, or key',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Tag filter, Ex: nature, landscape' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tag?: string;

  @ApiPropertyOptional({ description: 'MIME type filter, Ex: image/jpeg' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: MediaSortBy,
    default: MediaSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(MediaSortBy)
  sortBy?: MediaSortBy = MediaSortBy.CREATED_AT;
}
