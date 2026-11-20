import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum SupplierStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export class CreateSupplierDto {
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  code?: string;


  @ApiProperty({
    description: 'Name of the supplier',
    example: 'Acme Corporation',
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Contact person name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({
    description: 'Supplier email address',
    example: 'john.doe@acme.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Supplier phone number',
    example: '+919876543210',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'GST number of the supplier',
    example: '29AAAAA1111A1Z1',
  })
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional({
    description: 'PAN number of the supplier',
    example: 'ABCDE1234F',
  })
  @IsOptional()
  @IsString()
  panNumber?: string;

  @ApiPropertyOptional({
    description: 'Supplier physical address',
    example: '123 Industrial Area, Phase 1, Bangalore, India',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Payment terms description',
    example: 'Net 30',
  })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({
    description: 'Bank details for payments',
    type: 'object',
    example: { bankName: 'SBI', accountNo: '1234567890', ifsc: 'SBIN0001234' },
  })
  @IsOptional()
  bankDetails?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Internal notes about the supplier',
    example: 'Preferred supplier for custom gift packaging',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Supplier status',
    enum: SupplierStatusDto,
    default: SupplierStatusDto.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SupplierStatusDto)
  status?: SupplierStatusDto;
}

