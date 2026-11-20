import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { InvoiceType } from '../../enums/payment.enum';
import { CreateCustomerDto } from './create-customer.dto';

class InvoiceItemDto {
  @ApiProperty({
    description: 'Name of the item',
    example: 'Burger Combo',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Description of the item',
    example: 'Large burger with fries',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Amount in paise',
    example: 40000,
  })
  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @ApiProperty({
    description: 'Currency',
    example: 'INR',
  })
  @IsString()
  currency!: string;

  @ApiProperty({
    description: 'Quantity',
    example: 2,
  })
  @Type(() => Number)
  @IsNumber()
  quantity!: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    enum: InvoiceType,
    example: InvoiceType.INVOICE,
  })
  @IsEnum(InvoiceType)
  type!: InvoiceType;

  @ApiProperty({
    type: CreateCustomerDto,
  })
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer!: CreateCustomerDto;

  @ApiProperty({
    type: [InvoiceItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  line_items!: InvoiceItemDto[];
}
