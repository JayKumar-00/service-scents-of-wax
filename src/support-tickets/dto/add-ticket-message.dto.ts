import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { toBoolean } from 'src/common/utils/transform-cutome.util';

export class AddTicketMessageDto {
  @ApiProperty({
    description: 'Message body',
    example: 'I am facing an issue with my order.',
  })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiProperty({
    description:
      'Indicates if the message is internal (visible only to staff) or not',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  isInternal?: boolean;
}
