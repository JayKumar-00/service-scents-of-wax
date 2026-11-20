import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateProductReviewDto } from './create-product-review.dto';

export class UpdateProductReviewDto extends PartialType(
  OmitType(CreateProductReviewDto, [
    'productId',
    'orderId',
    'variantId',
  ] as const),
) {
  @ApiPropertyOptional({
    description: 'Admin only: Approve or unapprove the review',
  })
  @IsBoolean()
  @IsOptional()
  approved?: boolean;
}
