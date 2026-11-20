import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ProcessRefundDto {
  @ApiHideProperty()
  @IsString()
  @IsOptional()
  refundReferenceId?: string;

  @ApiProperty({ description: 'Optional remarks/notes', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class FailRefundDto {
  @ApiProperty({ description: 'Failure details or remarks' })
  @IsString()
  @IsNotEmpty()
  remarks!: string;
}
