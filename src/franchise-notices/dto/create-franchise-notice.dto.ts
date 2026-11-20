import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { NoticeAudience } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateFranchiseNoticeDto {
  @ApiProperty({
    description: 'Title of the notice',
    example: 'Scheduled Maintenance on 2024-07-01',
  })
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Body/content of the notice',
    example:
      'Dear Franchisees, please be informed that there will be a scheduled maintenance on our platform on July 1st, 2024 from 1:00 AM to 5:00 AM UTC. During this time, the system will be unavailable. We apologize for any inconvenience caused and appreciate your understanding.',
  })
  @IsString()
  @MinLength(1)
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({
    description:
      'Target franchise IDs. Required when audience is SINGLE_FRANCHISE.',
    type: [String],
    example: ['franchise-123', 'franchise-456'],
  })
  @IsOptional()
  @Type(() => String)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  franchiseIds?: string[];

  @ApiPropertyOptional({
    description: 'Audience for the notice.',
    enum: NoticeAudience,
    example: NoticeAudience.SINGLE_FRANCHISE,
  })
  @IsEnum(NoticeAudience)
  @IsNotEmpty()
  audience!: NoticeAudience;
}
