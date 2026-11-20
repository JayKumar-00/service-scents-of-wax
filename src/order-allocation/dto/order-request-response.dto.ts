import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnlinePaymentMethod } from 'src/orders/dto/create-order.dto';

export class OrderRequestResponseDto {
  @ApiProperty()
  requestId!: string;

  @ApiProperty({ example: 'SEARCHING_FRANCHISE' })
  status!: string;

  @ApiPropertyOptional({
    nullable: true,
    enum: OnlinePaymentMethod,
    example: OnlinePaymentMethod.ONLINE,
  })
  onlinePaymentMethod?: OnlinePaymentMethod | null;

  @ApiPropertyOptional({ nullable: true })
  discountCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  promotionDiscountAmount?: string | null;

  @ApiPropertyOptional({ nullable: true })
  orderNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  payableAmount?: string | null;
}
