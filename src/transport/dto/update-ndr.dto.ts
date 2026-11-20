import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsDateString,
} from 'class-validator';

export enum NdrAction {
  FAKE_ATTEMPT = 'fake-attempt',
  RE_ATTEMPT = 're-attempt',
  RETURN = 'return',
}

export class UpdateNdrDto {
  @ApiProperty({
    description:
      'Action to perform on shipment in NDR state. Allowed values: fake-attempt, re-attempt, return',
    example: 're-attempt',
    enum: NdrAction,
  })
  @IsEnum(NdrAction)
  action!: NdrAction;

  @ApiProperty({
    description: 'Reason or comment for the NDR action',
    example: 'Customer requested re-delivery on another date',
  })
  @IsString()
  @IsNotEmpty()
  comments!: string;

  @ApiPropertyOptional({
    description: 'Customer phone number (used for re-attempt or fake-attempt)',
    example: '9999988888',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Proof audio URL (required for fake-attempt)',
    example:
      'https://s3-ap-southeast-1.amazonaws.com/kr-multichannel/imports/ndr/audio.mp3',
  })
  @IsOptional()
  @IsUrl()
  proof_audio?: string;

  @ApiPropertyOptional({
    description: 'Proof image URL (required for fake-attempt)',
    example:
      'https://s3-ap-southeast-1.amazonaws.com/kr-multichannel/imports/ndr/image.jpg',
  })
  @IsOptional()
  @IsUrl()
  proof_image?: string;

  @ApiPropertyOptional({
    description: 'Remarks for fake-attempt action',
    example: 'Delivery attempted but customer unavailable',
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Updated address line 1',
    example: 'U-56, Sector-23',
  })
  @IsOptional()
  @IsString()
  address1?: string;

  @ApiPropertyOptional({
    description: 'Updated address line 2',
    example: 'Noida, Uttar Pradesh, India',
  })
  @IsOptional()
  @IsString()
  address2?: string;

  @ApiPropertyOptional({
    description: 'Preferred delivery date (for re-attempt or fake-attempt)',
    example: '2026-03-25',
  })
  @IsOptional()
  @IsDateString()
  deferred_date?: string;
}
