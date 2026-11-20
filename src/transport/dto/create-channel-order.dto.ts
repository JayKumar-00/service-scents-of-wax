import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum ShipmentProvider {
  SHIPROCKET = 'shiprocket',
  DELHIVERY = 'delhivery',
  TEST = 'test',
}

export enum ShipmentPaymentMode {
  COD = 'COD',
  PREPAID = 'Prepaid',
}

export enum ShipmentOrderType {
  ESSENTIALS = 'ESSENTIALS',
  NON_ESSENTIALS = 'NON ESSENTIALS',
}
export class CreateShipmentChannelDto {
  @ApiProperty({
    description: `Pickup location for the order, Ex: 'Home'`,
    example: 'Home',
  })
  @IsString()
  @IsOptional()
  pickup_location?: string;

  @ApiProperty({
    description: `Channel ID from the transport provider, Ex: 'shiprocket'`,
    example: '3167',
  })
  @IsString()
  @IsNotEmpty()
  channel_id!: string;

  @ApiProperty({
    description: `Valid Mobile number of the customer, Ex: '9713925204'`,
    example: '9713925204',
  })
  @IsString()
  @IsOptional()
  phone_number?: string;

  @ApiPropertyOptional({
    description: `If shipping address is same as billing address, set this to 1`,
    example: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Transform(({ value }) => (value === '1' ? 1 : 0)) // Convert '1' to 1, else 0
  @IsOptional()
  shipping_is_billing?: number = 1;

  @ApiPropertyOptional({
    description: `Gift wrap charges, Ex: 50`,
    example: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  giftwrap_charges?: number;

  @ApiProperty({
    description: `Order date in ISO format, Ex: '2026-02-14'`,
    example: '2026-02-14',
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({
    description: `Order type, Ex: 'ESSENTIALS'`,
  })
  @Transform(({ value }) =>
    value !== ShipmentOrderType.ESSENTIALS ? 'ESSENTIALS' : 'NON ESSENTIALS',
  )
  @IsOptional()
  order_type?: ShipmentOrderType;
}
