import { IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAutomationDto {
  @ApiProperty({ description: 'Enable/disable auto penalty', required: false })
  @IsBoolean()
  @IsOptional()
  autoPenaltyEnabled?: boolean;

  @ApiProperty({
    description: 'Enable/disable auto credit increase (15-day refill)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  autoCreditIncreaseEnabled?: boolean;

  @ApiProperty({ description: 'Enable/disable auto reminder', required: false })
  @IsBoolean()
  @IsOptional()
  autoReminderEnabled?: boolean;

  @ApiProperty({
    description: 'Pause automation until this date (ISO 8601 format)',
    required: false,
    example: '2026-05-14T10:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  automationPausedUntil?: string;
}
