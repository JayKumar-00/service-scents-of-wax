import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendCampaignDto {
  @ApiProperty({ description: 'Campaign title' })
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Campaign body message' })
  @IsNotEmpty()
  @IsString()
  body!: string;

  @ApiProperty({ description: 'Campaign type: IMMEDIATE, SCHEDULED, CATEGORY' })
  @IsNotEmpty()
  @IsString()
  type!: string;

  @ApiPropertyOptional({ description: 'Scheduled date and time' })
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: 'Category ID for interest-based targeting',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
