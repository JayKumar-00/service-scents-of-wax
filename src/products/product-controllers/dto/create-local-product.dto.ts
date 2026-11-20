import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/* -------------------- HELPERS -------------------- */

const toNumber = (value: any) => {
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};

const toBoolean = (value: any) => {
  return value === true || value === 'true';
};

const toArray = (value: any) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map((v) => v.trim());
  }
  return [];
};

const toObject = (value: any) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
};

/* -------------------- SUB DTOs -------------------- */

export class ChargesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  packagingFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  platformFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  taxPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  otherCharges?: number;
}

class MOQDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => toNumber(value))
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => toNumber(value))
  @IsOptional()
  @IsNumber()
  max?: number; // ✅ fixed
}

class PriceDto {
  @ApiProperty()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  mrpPrice!: number;

  @ApiProperty()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  sellingPrice!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value, obj }) => toNumber(value) ?? obj.sellingPrice)
  @IsNumber()
  productSellingPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value, obj }) => {
    if (value) return toNumber(value);
    if (obj.mrpPrice && obj.sellingPrice) {
      return Math.round(
        ((obj.mrpPrice - obj.sellingPrice) / obj.mrpPrice) * 100,
      );
    }
  })
  @IsNumber()
  discountPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  paymentGatewayFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  commision?: number;
}

class SeoDto {
  @ApiProperty()
  @Transform(({ value }) => value?.trim())
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  sub_title?: string;

  @ApiProperty()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  keywords!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  tags?: string[];
}

export class ExplicitAttributeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  value?: string;
}

/* -------------------- MAIN DTO -------------------- */

export class CreateLocalProductDto {
  @ApiProperty()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  sub_title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value, obj }) =>
    value
      ? value.trim().toLowerCase().replace(/\s+/g, '-')
      : obj.name?.toLowerCase().replace(/\s+/g, '-'),
  )
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ type: MOQDto })
  @IsOptional()
  @Transform(({ value }) => toObject(value))
  @ValidateNested()
  @Type(() => MOQDto)
  moq?: MOQDto;

  @ApiProperty()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  stock!: number;

  @ApiProperty({ type: PriceDto })
  @Transform(({ value }) => toObject(value))
  @ValidateNested()
  @Type(() => PriceDto)
  price!: PriceDto;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  hsnCode?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  description?: string;

  @ApiProperty()
  @Transform(({ value }) => value?.trim())
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim() || 'Anonymous')
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  imageUrl?: string;

  @ApiProperty()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  imageUrls!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsString({ each: true })
  attributeIds?: string[];

  @ApiPropertyOptional({ type: [ExplicitAttributeDto] })
  @IsOptional()
  @Transform(({ value }) => toObject(value))
  @ValidateNested({ each: true })
  @Type(() => ExplicitAttributeDto)
  explicitAttributes?: ExplicitAttributeDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  features?: string[];

  @ApiProperty({ type: SeoDto })
  @Transform(({ value }) => toObject(value))
  @ValidateNested()
  @Type(() => SeoDto)
  seo!: SeoDto;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  franchiseEarnings?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  fastDelivery?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  occasions?: string;
}
