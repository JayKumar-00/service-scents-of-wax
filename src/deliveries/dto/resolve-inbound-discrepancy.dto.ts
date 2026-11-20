import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResolveInboundDiscrepancyDto {
  @ApiPropertyOptional({
    description:
      'An optional note providing details about how the discrepancy was resolved. Recommended to include for audit purposes.',
    example:
      'Discrepancy resolved by adjusting inventory counts after recounting received items.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  resolutionNote?: string;
}
