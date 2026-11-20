import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaymentForEnum } from '../../enums/payment.enum';

export class CreditOrder {
  @ApiProperty({
    description: 'Unique identifier for the credit order',
    example: 'cred_1234567890',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Amount for Credit',
    example: 500,
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  amount!: number;
}

export class StockRequestOrder {
  @ApiProperty({
    description: 'Unique identifier for the stock request order',
    example: 'sr_1234567890',
  })
  @IsString()
  id!: string;
}

export class CreatePaymentOrderDto {
  @ApiProperty({
    description: 'Purpose of the payment',
    enum: PaymentForEnum,
  })
  @IsEnum(PaymentForEnum)
  @IsNotEmpty()
  paymentFor!: PaymentForEnum;

  // REQUIRED ONLY FOR CREDITS
  @ApiPropertyOptional({
    description: 'Credit order details',
    type: CreditOrder,
  })
  @ValidateIf((o) => o.paymentFor === PaymentForEnum.CREDITS)
  @IsNotEmpty({
    message: 'creditAccount is required when paymentFor is CREDITS',
  })
  @ValidateNested()
  @Type(() => CreditOrder)
  creditAccount?: CreditOrder;

  // REQUIRED ONLY FOR STOCK REQUESTS
  @ApiPropertyOptional({
    description: 'Stock request order details',
    type: StockRequestOrder,
  })
  @ValidateIf((o) => o.paymentFor === PaymentForEnum.STOCK_REQUESTS)
  @IsNotEmpty({
    message: 'stockRequest is required when paymentFor is STOCK_REQUESTS',
  })
  @ValidateNested()
  @Type(() => StockRequestOrder)
  stockRequest?: StockRequestOrder;

  // REQUIRED ONLY FOR PRODUCTS
  @ApiPropertyOptional({
    description: 'Product order ID',
    example: 'prod_1234567890',
  })
  @ValidateIf((o) => o.paymentFor === PaymentForEnum.PRODUCTS)
  @IsNotEmpty({
    message: 'productOrderId is required when paymentFor is PRODUCTS',
  })
  @IsString()
  productOrderNumber?: string;

  @ApiPropertyOptional({
    description: 'Currency for the order',
    example: 'INR',
    default: 'INR',
  })
  @IsOptional()
  @IsString()
  currency?: string;
}
