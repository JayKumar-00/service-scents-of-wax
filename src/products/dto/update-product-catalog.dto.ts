// import { Type } from 'class-transformer';
// import {
//   IsArray,
//   IsBoolean,
//   IsNumber,
//   IsOptional,
//   IsString,
//   Max,
//   MaxLength,
//   Min,
//   MinLength,
// } from 'class-validator';

// export class UpdateProductCatalogDto {
//   @IsOptional()
//   @IsString()
//   @MinLength(1)
//   @MaxLength(200)
//   name?: string;

//   @IsOptional()
//   @IsString()
//   @MinLength(2)
//   @MaxLength(120)
//   slug?: string;

//   @IsOptional()
//   @IsString()
//   description?: string;

//   @IsOptional()
//   @IsString()
//   @MaxLength(120)
//   brand?: string;

//   @IsOptional()
//   @IsString()
//   occasions?: string;

//   @IsOptional()
//   @IsString()
//   categoryId?: string;

//   @IsOptional()
//   @IsBoolean()
//   active?: boolean;

//   @IsOptional()
//   @IsBoolean()
//   fastDelivery?: boolean;

//   @IsOptional()
//   @IsBoolean()
//   isFeatured?: boolean;

//   @IsOptional()
//   @IsNumber()
//   @Min(0)
//   @Type(() => Number)
//   price?: number;

//   @IsOptional()
//   @IsNumber()
//   @Min(0)
//   @Type(() => Number)
//   mrpPrice?: number;

//   @IsOptional()
//   @IsNumber()
//   @Min(0)
//   @Max(28)
//   @Type(() => Number)
//   defaultGstRatePercent?: number;

//   @IsOptional()
//   @IsString()
//   imageUrl?: string;

//   @IsOptional()
//   @IsArray()
//   @IsString({ each: true })
//   imageUrls?: string[];
// }
