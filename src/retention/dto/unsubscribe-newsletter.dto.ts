import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class UnsubscribeNewsletterDto {
  @ApiProperty({
    example: 'customer@example.com',
    description: 'Email address to unsubscribe',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
