import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateCustomerAddressDto } from 'src/users/dto/address.dto';
import { FulfillmentPreference, SaleType } from '../../enums/order.enum';
import { AddressDto, OnlinePaymentMethod } from '../../dto/create-order.dto';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';

export class AllocateCartOrderDto {
  @ApiPropertyOptional({
    description: 'Fulfillment mode for the order allocation',
    enum: FulfillmentPreference,
    example: FulfillmentPreference.ALLOW_SPLIT,
  })
  @IsOptional()
  @IsEnum(FulfillmentPreference)
  fulfillmentPreference!: FulfillmentPreference;

  @ApiPropertyOptional({
    description: 'Online payment method selected by the customer',
    enum: OnlinePaymentMethod,
    example: OnlinePaymentMethod.ONLINE,
  })
  @IsOptional()
  @IsEnum(OnlinePaymentMethod)
  onlinePaymentMethod?: OnlinePaymentMethod;

  @ApiProperty({
    description: 'Delivery latitude coordinate',
    example: 37.7749,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiProperty({
    description: 'Delivery longitude coordinate',
    example: -122.4194,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  // DeliveryAddress can be either a structured object or a simple string, but here we use a DTO for better validation and documentation
  @ApiProperty({
    description:
      'Delivery address details (can be a structured object or a simple string)',
    example: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'USA',
    },
  })
  @Type(() => AddressDto)
  @ValidateNested()
  address!: AddressDto;

  // Charges and Discounts
  @ApiPropertyOptional({
    example: 25,
    description:
      'Shipping fee (if not provided, defaults to 0). Should be calculated based on franchise shipping rates.',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @ApiPropertyOptional({
    example: 'SAVE100',
    description: 'Optional discount code',
  })
  @IsOptional()
  @IsString()
  discountCode?: string;

  @ApiPropertyOptional({
    description:
      'Toggle to apply your loyalty points for a discount directly at checkout (10 points = ₹1)',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    ['true', '1', 1, true].includes(value) ? true : false,
  )
  @IsBoolean()
  useLoyaltyPoints?: boolean;

  @ApiPropertyOptional({
    example: 'FREECODE101',
    description: 'Affiliate referral code used by customer',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;

  /** When false (default), CGST+SGST split is used for GST totals in the billing snapshot. */
  @ApiPropertyOptional({
    description:
      'Whether to use IGST for GST totals in the billing snapshot (applicable for inter-state deliveries in India)',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    ['true', '1', 1, true].includes(value) ? true : false,
  )
  @IsBoolean()
  isInterState?: boolean;

  // Additional MSG
  @ApiProperty({
    description: 'Optional gift message to include with the order',
    example: 'Happy Birthday! Enjoy your gift.',
  })
  @IsString()
  @IsOptional()
  giftMessage?: string;

  @ApiPropertyOptional({
    description: 'Whether to request gift wrapping for the order',
    enum: BooleanEnum,
    default: BooleanEnum.FALSE,
    example: BooleanEnum.FALSE,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  giftWrap?: BooleanEnum = BooleanEnum.FALSE;

  @ApiPropertyOptional({
    description: 'Sale type option: DELIVERY or PICKUP',
    enum: SaleType,
    example: SaleType.DELIVERY,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const val = value.toUpperCase();
      if (val === 'PICKUP') return SaleType.PICKUP;
      if (val === 'DELIVERY') return SaleType.DELIVERY;
    }
    return value;
  })
  @IsEnum(SaleType)
  saleType?: SaleType;

  @ApiPropertyOptional({
    description: 'Specific franchise ID for customer pickup',
    example: 'fran_12345',
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Scheduled pickup window start time',
    example: '2026-08-06T15:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  fromPickupScheduleTime?: string;

  @ApiPropertyOptional({
    description: 'Scheduled pickup window end time',
    example: '2026-08-06T17:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  toPickupScheduleTime?: string;
}

export class CreateOrderFromCartDto extends AllocateCartOrderDto {}
