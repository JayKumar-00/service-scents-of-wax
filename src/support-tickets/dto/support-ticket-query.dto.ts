import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  SupportTicketStatus,
  SupportTicketType,
  TicketPriority,
} from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  PRIORITY = 'priority',
}

export class TicketQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search text ( Subject), Ex: 'text'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: `Type`,
    enum: SupportTicketType,
  })
  @IsOptional()
  @IsEnum(SupportTicketType)
  type?: SupportTicketType;

  @ApiPropertyOptional({
    description: `Priority`,
    enum: TicketPriority,
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    description: `Status`,
    enum: SupportTicketStatus,
  })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
