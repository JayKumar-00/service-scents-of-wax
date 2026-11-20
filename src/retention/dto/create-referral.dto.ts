import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateReferralDto {
  @ApiProperty({
    example: 'customer-referrer-id',
    description: 'The customer ID or referral code of the referrer',
  })
  @IsString()
  @IsNotEmpty()
  referrerCode!: string;

  @ApiProperty({
    example: 'referee@example.com',
    description: 'The email address of the person being referred',
  })
  @IsEmail()
  @IsNotEmpty()
  refereeEmail!: string;
}
