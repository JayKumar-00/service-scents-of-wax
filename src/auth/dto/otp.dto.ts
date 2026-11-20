// import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

// /**
//  * DTO for verifying email OTP
//  * @class VerifyEmailOtpDto
//  */
// export class VerifyEmailOtpDto {
//   /**
//    * User email address
//    * @example 'user@gmail.com'
//    */
//   @IsEmail()
//   @IsNotEmpty()
//   email!: string;

//   /**
//    * One-Time Password (OTP) - 6 digits
//    * @example '123456'
//    */
//   @IsString()
//   @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
//   @IsNotEmpty()
//   otp!: string;
// }

// /**
//  * DTO for verifying phone OTP
//  * @class VerifyPhoneOtpDto
//  */
// export class VerifyPhoneOtpDto {
//   /**
//    * User phone number
//    * @example '8088978979'
//    */
//   @IsString()
//   @IsNotEmpty()
//   phone!: string;

//   /**
//    * User password
//    * @example '********'
//    */
//   @IsString()
//   @IsNotEmpty()
//   password!: string;

//   /**
//    * One-Time Password (OTP) - 6 digits
//    * @example '123456'
//    */
//   @IsString()
//   @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
//   otp!: string;
// }

// /**
//  * DTO for resending OTP via email
//  * @class ResendOtpDto
//  */
// export class ResendOtpDto {
//   /**
//    * User email address
//    * @example 'user@gmail.com'
//    */
//   @IsEmail()
//   email!: string;
// }

// /**
//  * DTO for user registration
//  * @class RegistrationDto
//  * @extends VerifyEmailOtpDto
//  */
// export class RegistrationDto extends VerifyEmailOtpDto {
//   /**
//    * User password
//    * @example '********'
//    */
//   @IsString()
//   @IsNotEmpty()
//   password!: string;
// }
