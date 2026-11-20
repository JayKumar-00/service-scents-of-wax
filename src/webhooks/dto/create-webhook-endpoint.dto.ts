import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateWebhookEndpointDto {
  @ApiPropertyOptional({
    description: 'A descriptive label for the webhook endpoint',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    description: 'The URL to which the webhook events will be sent',
  })
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiPropertyOptional({ description: 'Secret used to sign webhook payloads' })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({
    description:
      'Comma-separated list of events to subscribe to, or "*" for all events',
    default: '*',
  })
  @IsOptional()
  @IsString()
  events?: string;

  @ApiPropertyOptional({
    description: 'Whether the webhook endpoint is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
