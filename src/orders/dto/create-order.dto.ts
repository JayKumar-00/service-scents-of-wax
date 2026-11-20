import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SaleType } from '../enums/order.enum';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';

export enum OnlinePaymentMethod {
  COD = 'COD',
  ONLINE = 'ONLINE',
}

export class AddressDto {
  @IsString()
  street!: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsString()
  postalCode!: string;

  @IsString()
  country!: string;
}

export class OrderLineDto {
  @ApiProperty({
    description: 'ID of the product being ordered',
    example: 'prod_12345',
  })
  @IsOptional()
  @IsString()
  productId!: string;

  @ApiProperty({
    description: 'Quantity of the product being ordered',
    example: 2,
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'List of items in the order',
    type: [OrderLineDto],
    example: [
      { productId: 'prod_12345', variantId: 'var_67890', quantity: 2 },
      { productId: 'prod_54321', quantity: 1 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];

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
  @IsObject()
  @IsNotEmpty()
  address!: AddressDto;

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
    description: 'Optional coupon / discount code',
    example: 'SAVE100',
  })
  @IsString()
  @IsOptional()
  discountCode?: string;

  @ApiPropertyOptional({
    description: 'Online payment method selected by the customer',
    enum: OnlinePaymentMethod,
    example: OnlinePaymentMethod.ONLINE,
  })
  @IsEnum(OnlinePaymentMethod)
  @IsNotEmpty()
  onlinePaymentMethod!: OnlinePaymentMethod;

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

  @ApiPropertyOptional({
    description: 'Affiliate referral code used by customer',
    example: 'FREECODE101',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
