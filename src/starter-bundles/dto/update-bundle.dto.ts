import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StarterBundleStatus, BundleType, OnlinePaymentStatus } from '@prisma/client';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';

export class UpdateStarterBundleDto {
  @ApiPropertyOptional({
    description: 'Name of the starter bundle',
    example: 'Updated Premium Franchise Starter Pack',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Type of the starter bundle',
    enum: BundleType,
  })
  @IsOptional()
  @IsEnum(BundleType)
  type?: BundleType;

  @ApiPropertyOptional({
    description: 'Description of the starter bundle',
    example: 'Updated description of bundle contents.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Status of the starter bundle (ACTIVE or INACTIVE)',
    enum: StarterBundleStatus,
  })
  @IsOptional()
  @IsEnum(StarterBundleStatus)
  status?: StarterBundleStatus;

  @ApiPropertyOptional({
    description: 'Whether to assign this bundle automatically on franchise creation',
    enum: BooleanEnum,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  autoAssignOnCreate?: BooleanEnum;

  @ApiPropertyOptional({
    description: 'Whether this bundle is the default onboarding bundle',
    enum: BooleanEnum,
  })
  @IsOptional()
  @IsEnum(BooleanEnum)
  isDefault?: BooleanEnum;

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
  })
  @IsOptional()
  @IsEnum(OnlinePaymentStatus)
  paymentStatus?: OnlinePaymentStatus;
}
