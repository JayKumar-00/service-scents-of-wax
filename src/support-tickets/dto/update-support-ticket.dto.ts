import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SupportTicketStatus, TicketPriority } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSupportTicketDto {
  @ApiPropertyOptional({
    description: 'Status of the support ticket',
    enum: SupportTicketStatus,
  })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({
    description: 'Priority of the support ticket',
    enum: TicketPriority,
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    description: 'ID of the user to whom the ticket is assigned',
    type: String,
  })
  @IsOptional()
  @IsString()
  assignedToUserId?: string | null;
}
