import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { SupportTicketType, TicketPriority } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupportTicketDto {
  @ApiProperty({
    description: 'Type of support ticket',
    enum: SupportTicketType,
  })
  @IsEnum(SupportTicketType)
  @IsNotEmpty()
  type!: SupportTicketType;

  @ApiProperty({
    description: 'Subject of the support ticket',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  subject!: string;

  @ApiPropertyOptional({
    description: 'Initial message for the support ticket',
    minLength: 1,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  initialMessage?: string;

  @ApiPropertyOptional({
    description: 'Priority of the support ticket',
    enum: TicketPriority,
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
