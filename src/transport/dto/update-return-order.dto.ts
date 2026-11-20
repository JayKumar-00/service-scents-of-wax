import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ArrayNotEmpty,
  IsNumber,
  IsIn,
  IsNotEmpty,
  Min,
  IsOptional,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateReturnOrderDto {
  @ApiProperty({
    description: 'Shiprocket Order ID',
    example: '79596',
  })
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @ApiProperty({
    description: 'Actions to perform on order',
    example: ['product_details'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(['product_details'], { each: true }) // 🔥 restrict allowed values
  @IsNotEmpty()
  action!: string[];

  @ApiPropertyOptional({
    description:
      'Package length in cm (minimum 10 cm recommended by Shiprocket). Default: 10',
    example: 10,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => (value >= 1 ? value : 10))
  @IsOptional()
  length?: number;

  @ApiProperty({
    description:
      'Package breadth in cm (minimum 10 cm recommended). Default: 10',
    example: 10,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => (value >= 1 ? value : 10))
  @IsOptional()
  breadth?: number;

  @ApiPropertyOptional({
    description:
      'Package height in cm (minimum 10 cm recommended). Default: 10',
    example: 10,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => (value >= 1 ? value : 10))
  @IsOptional()
  height?: number;

  @ApiProperty({
    description:
      'Package weight in kg (minimum 0.5 kg recommended). Default: 0.5',
    example: 0.5,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Transform(({ value }) => (value >= 0.1 ? value : 0.5))
  @IsOptional()
  weight?: number;
}
