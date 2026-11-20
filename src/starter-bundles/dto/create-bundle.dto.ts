import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StarterBundleStatus, BundleType, OnlinePaymentStatus } from '@prisma/client';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';

export class CreateStarterBundleDto {
  @ApiProperty({
    description: 'Name of the starter bundle',
    example: 'Premium Franchise Starter Pack',
  })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Type of the starter bundle',
    enum: BundleType,
    default: BundleType.STARTER,
  })
  @IsOptional()
  @IsEnum(BundleType)
  type?: BundleType;

  @ApiPropertyOptional({
    description: 'Description of the starter bundle',
    example: 'Contains initial inventory including 10 items of category A and 5 of category B.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Status of the starter bundle (ACTIVE or INACTIVE)',
    enum: StarterBundleStatus,
    default: StarterBundleStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(StarterBundleStatus)
  status?: StarterBundleStatus;

  @ApiPropertyOptional({
    description: 'Whether this is the default bundle',
    enum: BooleanEnum,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  isDefault?: BooleanEnum;

  @ApiPropertyOptional({
    description: 'Whether to assign this bundle automatically on franchise creation',
    enum: BooleanEnum,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  autoAssignOnCreate?: BooleanEnum;

  @ApiPropertyOptional({
    description: 'Unique transaction ID of the payment for the starter bundle',
    example: 'txn_1234567890',
  })
  @IsOptional()
  @IsString()
  txtId?: string;

  @ApiPropertyOptional({
    description: 'Payment status of the starter bundle',
    enum: OnlinePaymentStatus,
    default: OnlinePaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(OnlinePaymentStatus)
  paymentStatus?: OnlinePaymentStatus;
}
