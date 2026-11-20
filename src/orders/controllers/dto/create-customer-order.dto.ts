import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateCustomerAddressDto } from 'src/users/dto/address.dto';

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
  address!: CreateCustomerAddressDto;

  @ApiProperty({
    description: 'Optional gift message to include with the order',
    example: 'Happy Birthday! Enjoy your gift.',
  })
  @IsString()
  @IsOptional()
  giftMessage?: string;

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
    description: 'Affiliate referral code used by customer',
    example: 'FREECODE101',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
