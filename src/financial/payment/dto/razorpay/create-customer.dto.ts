import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({
    description: "Customer's full name",
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Email address of the customer',
    example: 'user@gmail.com',
  })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Contact number of the customer',
    example: '9876543210',
  })
  @IsString()
  @IsNotEmpty()
  contact!: string;
}
