import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export class AtpQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search by product name, slug, sku, or product ID',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Product ID to check ATP for',
  })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Minimum ATP total quantity',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minQty?: number;

  @ApiPropertyOptional({
    description: 'Maximum ATP total quantity',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxQty?: number;

  @ApiPropertyOptional({
    description:
      "Franchise ID to check ATP for (optional, defaults to user's franchise if not provided)",
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;
}
