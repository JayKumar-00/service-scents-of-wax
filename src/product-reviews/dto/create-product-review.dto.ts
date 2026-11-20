import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateProductReviewDto {
  @ApiProperty({ description: 'The ID of the product being reviewed' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'The order ID associated with the purchase' })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiPropertyOptional({ description: 'The specific variant ID if applicable' })
  @IsString()
  @IsOptional()
  variantId?: string;

  @ApiProperty({
    description: 'Rating between 1 and 5',
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating!: number;

  @ApiProperty({ description: 'Review comment text' })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional array of review image URLs',
    example: ['/uploads/reviews/1724123456789-img.jpg'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional array of review video URLs',
    example: ['/uploads/reviews/1724123456789-video.mp4'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  videos?: string[];
}
