import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BaseOrderDto } from './base-order.dto';
import { SaleType } from '../enums/order.enum';
import { PaymentModeEnum } from '@prisma/client';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';

export class CreatePosSaleDto {
  @ApiProperty({
    description: 'Sale Type',
    enum: SaleType,
  })
  @IsEnum(SaleType)
  @IsNotEmpty()
  saleType!: SaleType;

  @ApiProperty({
    description: 'List of items in the sale',
    type: [BaseOrderDto],
    example: [
      {
        productId: 'prod_123',
        variantId: 'var_123',
        quantity: 2,
      },
      {
        productId: 'prod_456',
        quantity: 1,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BaseOrderDto)
  items!: BaseOrderDto[];

  @ApiProperty({
    description: 'Name of the customer',
    example: 'John Doe',
  })
  @IsString()
  customerName!: string;

  @ApiProperty({
    description: 'Phone number of the customer',
    example: '+91-9999999999',
  })
  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @ApiPropertyOptional({
    description: 'Email of the customer',
    example: 'user@gmail.com',
  })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  /** Buyer GSTIN (if B2B) */
  @ApiPropertyOptional({
    description: 'GSTIN of the customer (if applicable)',
    example: '22AAAAA0000A1Z5',
  })
  @IsOptional()
  @IsString()
  customerGstin?: string;

  /** Outlet GSTIN to print on invoice (optional) */
  @ApiPropertyOptional({
    description: 'GSTIN of the outlet (if applicable)',
    example: '22BBBBB1111B2Z6',
  })
  @IsOptional()
  @IsString()
  franchiseGstin?: string;

  @ApiPropertyOptional({
    description: 'Billing address details',
    example: {
      line1: '123 Main St',
      line2: 'Suite 4',
      city: 'Metropolis',
      state: 'NY',
      postalCode: '12345',
      country: 'USA',
    },
  })
  @IsOptional()
  @IsObject()
  billingAddress?: Record<string, unknown>;

  /** Combined GST % (0–28). Server recalculates tax from catalogue line totals. */
  @ApiPropertyOptional({
    description: 'Combined GST rate percentage (0-28)',
    example: 18,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(28)
  gstRatePercent?: number = 18;

  /** If true, full GST shown as IGST; else split equally into CGST + SGST */
  @ApiPropertyOptional({
    description: 'If true, show full GST as IGST; else split into CGST + SGST',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    ['true', '1', 1, true].includes(value) ? true : false,
  )
  isInterState?: boolean;

  @ApiProperty({
    description: 'Payment mode for the POS sale',
    enum: PaymentModeEnum,
    example: PaymentModeEnum.CASH,
  })
  @IsEnum(PaymentModeEnum)
  @IsNotEmpty()
  paymentMode!: PaymentModeEnum;

  @ApiPropertyOptional({
    description: 'Additional notes for the sale',
    example: 'Customer prefers evening delivery',
  })
  @IsOptional()
  @IsString()
  notes?: string;

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
    description: 'Optional custom gift message to be written on the card',
    example: 'Happy Birthday!',
  })
  @IsOptional()
  @IsString()
  giftMessage?: string;

  @ApiPropertyOptional({
    description: 'Affiliate referral code used by customer',
    example: 'FREECODE101',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
