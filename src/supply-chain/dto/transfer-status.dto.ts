import { ApiProperty } from '@nestjs/swagger';
import { StockTransferStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class TransferStatusDto {
  @ApiProperty({
    description: 'Status of the stock transfer',
    enum: StockTransferStatus,
    example: StockTransferStatus.IN_TRANSIT,
  })
  @IsEnum(StockTransferStatus)
  status!: StockTransferStatus;
}
