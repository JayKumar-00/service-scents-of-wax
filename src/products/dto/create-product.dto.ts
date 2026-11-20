// import { Type } from 'class-transformer';
// import {
//   IsArray,
//   IsBoolean,
//   IsNumber,
//   IsOptional,
//   IsString,
//   Max,
//   Min,
//   MinLength,
// } from 'class-validator';

// export class CreateProductDto {
//   @IsString()
//   @MinLength(2)
//   name!: string;

//   @IsString()
//   @MinLength(2)
//   slug!: string;

//   @IsOptional()
//   @IsString()
//   description?: string;

//   @Type(() => Number)
//   @IsNumber()
//   @Min(0)
//   price!: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsNumber()
//   @Min(0)
//   mrpPrice?: number;

//   @IsOptional()
//   @IsString()
//   imageUrl?: string;

//   @IsOptional()
//   @IsArray()
//   @IsString({ each: true })
//   imageUrls?: string[];

//   @IsOptional()
//   @Type(() => Boolean)
//   @IsBoolean()
//   active?: boolean;

//   @IsString()
//   categoryId!: string;

//   @IsOptional()
//   @IsString()
//   brand?: string;

//   @IsOptional()
//   @IsString()
//   occasions?: string;

//   @IsOptional()
//   @Type(() => Boolean)
//   @IsBoolean()
//   fastDelivery?: boolean;

//   @IsOptional()
//   @Type(() => Boolean)
//   @IsBoolean()
//   isFeatured?: boolean;

//   @IsOptional()
//   @Type(() => Number)
//   @IsNumber()
//   @Min(0)
//   @Max(5)
//   ratingAvg?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsNumber()
//   @Min(0)
//   reviewCount?: number;
// }
