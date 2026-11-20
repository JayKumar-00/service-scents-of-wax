import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ReturnInventoryEnum } from '../enums/return-inventory.enum';

export enum ReturnItemCondition {
  GOOD = 'GOOD',
  DEFECTIVE = 'DEFECTIVE',
  CONFLICT = 'CONFLICT',
}

@ValidatorConstraint({ name: 'productReturnCreateDtoRule', async: false })
class ProductReturnCreateDtoRule implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const dto = args.object as ProductReturnCreateDto;
    const hasOrderNumber =
      typeof dto.orderNumber === 'string' && dto.orderNumber.trim().length > 0;
    const hasStockRequestId =
      typeof dto.stockRequestId === 'string' &&
      dto.stockRequestId.trim().length > 0;

    if (hasOrderNumber === hasStockRequestId) {
      return false;
    }

    if (!Array.isArray(dto.oldItems) || dto.oldItems.length === 0) {
      return false;
    }

    const hasNewItems = Array.isArray(dto.newItems) && dto.newItems.length > 0;
    if (dto.type === ReturnInventoryEnum.EXCHANGE) {
      return hasNewItems;
    }

    if (hasStockRequestId) {
      return true;
    }

    return !hasNewItems;
  }

  defaultMessage() {
    return 'Provide exactly one source identifier, always include oldItems, allow optional newItems for stock-request returns, and only require newItems when type is EXCHANGE.';
  }
}

export class ReturnRefundInventoryItemDto {
  @ApiProperty({
    description: 'The ID of the product being returned or refunded.',
    example: 'prod_12345',
  })
  @IsString()
  productId!: string;

  @ApiPropertyOptional({
    description:
      'The ID of the product variant being returned or refunded, if applicable.',
    example: 'variant_12345',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({
    description: 'The quantity of the product being returned or refunded.',
    example: 2,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    description: 'Item condition used to route inventory and audit handling.',
    enum: ReturnItemCondition,
    example: ReturnItemCondition.GOOD,
  })
  @IsEnum(ReturnItemCondition)
  @IsOptional()
  condition?: ReturnItemCondition;
}

export class ProductReturnCreateDto {
  @ApiPropertyOptional({
    description: 'The order number associated with the return or refund.',
    example: 'ORD123456',
  })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({
    description:
      'The ID of the stock request associated with the return or refund, if applicable.',
    example: 'stock_req_12345',
  })
  @IsOptional()
  @IsString()
  stockRequestId?: string;

  @ApiHideProperty()
  @Validate(ProductReturnCreateDtoRule)
  private readonly _validationGuard?: never;

  @ApiProperty({
    description: 'The type of return or refund being processed.',
    example: 'RETURN',
    enum: ReturnInventoryEnum,
  })
  @IsEnum(ReturnInventoryEnum)
  @IsNotEmpty()
  type!: ReturnInventoryEnum;

  @ApiPropertyOptional({
    description: 'The reason for the return or refund, if provided.',
    example: 'The product was defective.',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'The list of items being returned or refunded.',
    type: [ReturnRefundInventoryItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnRefundInventoryItemDto)
  oldItems!: ReturnRefundInventoryItemDto[];

  @ApiPropertyOptional({
    description:
      'The list of new items being sent as part of an exchange, if applicable.',
    type: [ReturnRefundInventoryItemDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnRefundInventoryItemDto)
  newItems?: ReturnRefundInventoryItemDto[];
}

export class ReturnRequestRejectDto {
  @ApiProperty({
    description: 'Reason for rejecting the return request.',
    example: 'The return window has expired.',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
