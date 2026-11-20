import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectProposalDto {
  @ApiPropertyOptional({
    description: 'Optional rejection reason',
    example: 'Stock unavailable after validation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
