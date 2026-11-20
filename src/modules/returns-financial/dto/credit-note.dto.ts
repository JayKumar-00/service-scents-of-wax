import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCreditNoteDto {
  @ApiProperty({
    description: 'The Return Request ID related to the credit note',
  })
  @IsString()
  @IsNotEmpty()
  returnRequestId!: string;

  @ApiProperty({ description: 'Optional remarks/notes', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}
