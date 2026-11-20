import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { FulfillmentPreference } from '../../enums/order.enum';

export class CheckoutPreviewItemDto {
  @ApiProperty({ description: 'Product ID', example: 'prod_123' })
  @IsString()
  productId!: string;

  @ApiProperty({
    description: 'Product variant ID',
    example: 'var_456',
    required: false,
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ description: 'Required quantity', example: 2 })
  @IsNumber()
  quantity!: number;
}

export class CheckoutPreviewResponseItemDto {
  @ApiProperty({ description: 'Product ID', example: 'prod_123' })
  productId!: string;

  @ApiProperty({ description: 'Product name', example: 'Chocolate Cake' })
  productName!: string;

  @ApiProperty({
    description: 'Product variant ID',
    required: false,
    example: 'var_456',
  })
  variantId?: string;

  @ApiProperty({
    description: 'Variant name',
    required: false,
    example: 'Small',
  })
  variantName?: string;

  @ApiProperty({ description: 'Quantity required from the cart', example: 2 })
  quantity!: number;

  @ApiProperty({ description: 'Quantity requested from cart', example: 2 })
  requestedQuantity!: number;

  @ApiProperty({
    description: 'Quantity allocated from the franchise in this response block',
    example: 2,
  })
  allocatedQuantity!: number;

  @ApiProperty({ description: 'Unit price', example: 299.99 })
  unitPrice!: number;

  @ApiProperty({ description: 'Available stock at franchise', example: 10 })
  availableStock!: number;

  @ApiProperty({
    description: 'Remaining quantity still needed after this allocation',
    example: 0,
    required: false,
  })
  shortfallQuantity?: number;
}

export class SingleFranchiseResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ enum: ['SINGLE_FRANCHISE'] })
  mode!: 'SINGLE_FRANCHISE';

  @ApiProperty({ description: 'Franchise ID', example: 'fr_1' })
  franchiseId!: string;

  @ApiProperty({ description: 'Franchise name', example: 'Downtown Outlet' })
  franchiseName!: string;

  @ApiProperty({ type: [CheckoutPreviewResponseItemDto] })
  items!: CheckoutPreviewResponseItemDto[];

  @ApiProperty({ description: 'Estimated delivery time', example: '45 mins' })
  estimatedDelivery!: string;

  @ApiProperty({ description: 'Total distance in km', example: 5.2 })
  distanceKm!: number;
}

export class AllocationDto {
  @ApiProperty({ description: 'Franchise ID', example: 'fr_1' })
  franchiseId!: string;

  @ApiProperty({ description: 'Franchise name', example: 'Downtown Outlet' })
  franchiseName!: string;

  @ApiProperty({
    description: 'Distance from the delivery point in km',
    example: 4.2,
    required: false,
  })
  distanceKm?: number;

  @ApiProperty({ type: [CheckoutPreviewResponseItemDto] })
  items!: CheckoutPreviewResponseItemDto[];
}

export class MultiFranchiseResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ enum: ['MULTI_FRANCHISE_REQUIRED'] })
  mode!: 'MULTI_FRANCHISE_REQUIRED';

  @ApiProperty({ type: [AllocationDto] })
  allocations!: AllocationDto[];

  @ApiProperty({ example: true })
  customerChoiceRequired!: true;
}

export class UnfulfilledItemDto {
  @ApiProperty({ description: 'Product ID', example: 'prod_123' })
  productId!: string;

  @ApiProperty({ description: 'Product name', example: 'Chocolate Cake' })
  productName!: string;

  @ApiProperty({ description: 'Required quantity', example: 2 })
  requiredQuantity!: number;

  @ApiProperty({
    description: 'Quantity currently available across the nearest franchises',
    example: 1,
    required: false,
  })
  availableQuantity?: number;

  @ApiProperty({
    description: 'Reason for unfulfillment',
    example: 'No active franchise with stock',
  })
  reason!: string;
}

export class FranchiseCoverageDto {
  @ApiProperty({ description: 'Franchise ID', example: 'fr_1' })
  franchiseId!: string;

  @ApiProperty({ description: 'Franchise name', example: 'Downtown Outlet' })
  franchiseName!: string;

  @ApiProperty({
    description: 'Distance from the delivery point in km',
    example: 4.2,
  })
  distanceKm!: number;

  @ApiProperty({ type: [CheckoutPreviewResponseItemDto] })
  availableItems!: CheckoutPreviewResponseItemDto[];

  @ApiProperty({ type: [UnfulfilledItemDto] })
  missingItems!: UnfulfilledItemDto[];
}

export class OutOfStockResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ enum: ['OUT_OF_STOCK'] })
  mode!: 'OUT_OF_STOCK';

  @ApiProperty({ type: [UnfulfilledItemDto] })
  unfulfilledItems!: UnfulfilledItemDto[];
}

export class SingleOnlyUnavailableResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ enum: ['SINGLE_ONLY_UNAVAILABLE'] })
  mode!: 'SINGLE_ONLY_UNAVAILABLE';

  @ApiProperty({ type: [FranchiseCoverageDto] })
  coverage!: FranchiseCoverageDto[];

  @ApiProperty({ type: [UnfulfilledItemDto] })
  unfulfilledItems!: UnfulfilledItemDto[];
}

export class EmergencyPartialResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ enum: ['EMERGENCY_PARTIAL'] })
  mode!: 'EMERGENCY_PARTIAL';

  @ApiProperty({ type: [AllocationDto] })
  allocations!: AllocationDto[];

  @ApiProperty({ type: [UnfulfilledItemDto], required: false })
  unfulfilledItems?: UnfulfilledItemDto[];
}

export type CheckoutPreviewResponseDto =
  | SingleFranchiseResponseDto
  | MultiFranchiseResponseDto
  | EmergencyPartialResponseDto
  | SingleOnlyUnavailableResponseDto
  | OutOfStockResponseDto;

export class CheckoutPreviewQueryDto {
  @ApiPropertyOptional({
    description: 'Delivery latitude coordinate',
    example: 37.7749,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Delivery longitude coordinate',
    example: -122.4194,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Fulfillment preference',
    enum: FulfillmentPreference,
    example: FulfillmentPreference.SINGLE_ONLY,
    default: FulfillmentPreference.ALLOW_SPLIT,
  })
  @IsOptional()
  @IsEnum(FulfillmentPreference)
  fulfillmentPreference?: FulfillmentPreference;
}
