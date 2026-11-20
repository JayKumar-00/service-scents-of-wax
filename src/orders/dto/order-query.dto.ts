import {
  OnlinePaymentStatus,
  OrderChannel,
  OrderStatus,
  PaymentModeEnum,
} from '@prisma/client';
import { QueryDto } from 'src/common/dto/query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';
import { SaleType } from '../enums/order.enum';

export class OrderQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description:
      'Search term for deliveries (customer.email, product.name, orderNumber, invoiceNumber), Ex: "gift box"',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: `Is from platform, Ex: ${Object.values(BooleanEnum).join(', ')}`,
    enum: BooleanEnum,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  isFromPlatform?: BooleanEnum;

  @ApiPropertyOptional({
    description: `Sale type, Ex: ${Object.values(SaleType).join(', ')}`,
    enum: SaleType,
  })
  @IsOptional()
  @IsEnum(SaleType)
  saleType?: SaleType;

  @ApiPropertyOptional({
    description: 'Order number, Ex: ORD-12345',
  })
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @ApiPropertyOptional({
    description: 'Invoice number, Ex: INV-12345',
  })
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiPropertyOptional({
    description: 'Payment reference, Ex: PAY-12345',
  })
  @IsString()
  @IsOptional()
  paymentReference?: string;

  @ApiPropertyOptional({
    description: 'Payment provider, Ex: PhonePe, Google Pay',
  })
  @IsString()
  @IsOptional()
  paymentProvider?: string;

  @ApiPropertyOptional({
    description: `Online payment status, Ex: ${Object.values(OnlinePaymentStatus).join(', ')}`,
    enum: OnlinePaymentStatus,
  })
  @IsOptional()
  @IsEnum(OnlinePaymentStatus)
  onlinePaymentStatus?: OnlinePaymentStatus;

  @ApiPropertyOptional({
    description: `POS payment mode, Ex: ${Object.values(PaymentModeEnum).join(', ')}`,
    enum: PaymentModeEnum,
  })
  @IsOptional()
  @IsEnum(PaymentModeEnum)
  posPaymentMode?: PaymentModeEnum;

  @ApiPropertyOptional({
    description: `Payment mode, Ex: ${Object.values(PaymentModeEnum).join(', ')}`,
    enum: PaymentModeEnum,
  })
  @IsOptional()
  @IsEnum(PaymentModeEnum)
  paymentMode?: PaymentModeEnum;

  @ApiPropertyOptional({
    description: `Order status, Ex: ${Object.values(OrderStatus).join(', ')}`,
    enum: OrderStatus,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: `Order channel, Ex: ${Object.values(OrderChannel).join(', ')}`,
    enum: OrderChannel,
  })
  @IsOptional()
  @IsEnum(OrderChannel)
  channel?: OrderChannel;

  @ApiPropertyOptional({
    description: 'ID of the user who sold the order, Ex: user-12345',
  })
  @IsString()
  @IsOptional()
  soldByUserId?: string;

  @ApiPropertyOptional({
    description: 'ID of the user who created the order, Ex: user-12345',
  })
  @IsString()
  @IsOptional()
  retailCustomerId?: string;

  @ApiPropertyOptional({
    description: 'ID of the franchise, Ex: franchise-12345',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'ID of the customer, Ex: customer-12345',
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Customer address, Ex: Sector 62, Noida',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: 'From date of order creation (ISO), Ex: 2026-12-11',
  })
  @IsDateString()
  @IsOptional()
  fromPaidAt?: string;

  @ApiPropertyOptional({
    description: 'To date of order creation (ISO), Ex: 2026-12-11',
  })
  @IsDateString()
  @IsOptional()
  toPaidAt?: string;
}
