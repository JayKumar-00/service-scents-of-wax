import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export class SuggessionQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search term to filter product names',
  })
  @IsString()
  @IsOptional()
  search?: string; // product name filter

  @ApiProperty({
    description: 'Franchise ID to get suggession for',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Minimum quantity for suggession',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minQty?: number;

  @ApiPropertyOptional({
    description: 'Maximum quantity for suggession',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxQty?: number;
}
