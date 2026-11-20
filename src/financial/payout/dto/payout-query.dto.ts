import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';
import { PayoutStatus } from '@prisma/client';

export class PayoutQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter payouts by status',
    enum: PayoutStatus,
  })
  @IsEnum(PayoutStatus)
  @IsOptional()
  status?: PayoutStatus;

  @ApiPropertyOptional({
    description: 'Filter payouts by franchise ID',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;
}
