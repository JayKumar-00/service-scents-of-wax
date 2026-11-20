import { PartialType } from '@nestjs/swagger';
import { CreateLocalProductDto } from './create-local-product.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreateProductDto } from './create-product.dto';
import { toArray, toBoolean } from 'src/common/utils/transform-cutome.util';
import { ProductStatus } from '@prisma/client';

export class UpdateLocalProductDto extends PartialType(CreateLocalProductDto) {}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

/* -------------------- DTOs -------------------- */

export class ProductVisibilityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  visibility?: boolean;
}

export class ProductStatusDto {
  @ApiProperty({
    description: 'Status of the product',
    enum: ProductStatus,
    example: ProductStatus.ACTIVE,
  })
  @IsEnum(ProductStatus)
  @IsNotEmpty()
  status!: ProductStatus;
}

export class DeleteBulkProductsDto {
  @ApiProperty({
    type: [String],
    description: 'Ids of products to delete',
    example: ['id1', 'id2', 'id3'],
  })
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  ids!: string[];
}

export class UpdateRatingAverageDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  ratingAvg!: number;
}

export class UpdateReviewCountDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reviewCount!: number;
}
