import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WebhookDeliveryStatus } from '@prisma/client';
import { QueryDto } from '../../common/dto/query.dto';

export class WebhookDeliveryQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Filter by event name' })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({
    description: 'Filter by delivery status',
    enum: WebhookDeliveryStatus,
  })
  @IsOptional()
  @IsEnum(WebhookDeliveryStatus)
  status?: WebhookDeliveryStatus;

  @ApiPropertyOptional({ description: 'Sort by field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
