import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockTransferStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  STATUS = 'status',
}

export class StockTransferQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'ID of the source node (e.g., warehouse or store)',
  })
  @IsOptional()
  @IsString()
  fromNodeId?: string;

  @ApiPropertyOptional({
    description: 'ID of the destination node (e.g., warehouse or store)',
  })
  @IsOptional()
  @IsString()
  toNodeId?: string;

  @ApiPropertyOptional({
    description: `Filter by active status, Ex: ${Object.values(StockTransferStatus).join(',')}`,
    enum: StockTransferStatus,
  })
  @IsOptional()
  @IsEnum(StockTransferStatus)
  status?: StockTransferStatus;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
