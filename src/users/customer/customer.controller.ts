import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { Public } from 'src/common/decorators/public.decorator';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegistrationCustomerDto } from './dto/registration-customer.dto';
import {
  ChangePasswordDto,
  LoginDto,
  RecoveryDto,
  RefreshTokenDto,
  ResetPasswordDto,
  VerifyEmailOtpDto,
  VerifyPhoneOtpDto,
} from 'src/auth/dto/user.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { ResetPasswordWithOtpDto } from 'src/auth/dto/reset-password.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SendOtpDto } from 'src/otp/dto/send-otp.dto';
import { FirebaseAuthDto, FirebaseRefreshDto } from './dto/firebase-auth.dto';

@ApiTags('Customer Authentication')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post('auth/firebase')
  @Public()
  @ApiOperation({ summary: 'Login with Google / Facebook via Firebase' })
  @ApiBody({ type: FirebaseAuthDto })
  firebaseAuth(@Body() dto: FirebaseAuthDto) {
    return this.customerService.firebaseAuth(dto);
  }

  @Post('auth/firebase/refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh session using Firebase refresh token' })
  @ApiBody({ type: FirebaseRefreshDto })
  firebaseRefresh(@Body() dto: FirebaseRefreshDto) {
    return this.customerService.firebaseRefresh(dto);
  }

  @Post('/:phone(\\d{10,12})/otp')
  @Public()
  @ApiOperation({ summary: 'OTP sent (Registration/Recovery)' })
  sendOtpSms(@Param('phone') phone: string) {
    return this.customerService.sendOtpSms(phone);
  }

  @Post('/:email/otp')
  @Public()
  @ApiOperation({ summary: 'OTP sent (Registration)' })
  sendEmailOtp(@Param('email') email: string) {
    return this.customerService.sendOtpEmail(email);
  }

  @Post('/email/registration')
  @Public()
  @ApiOperation({
    summary: 'Franchise Email OTP verification for registration',
  })
  @ApiBody({ type: RegistrationCustomerDto })
  registrationViaEmail(@Body() dto: RegistrationCustomerDto) {
    return this.customerService.registrationByEmail(dto);
  }

  @Post('send-otp-login')
  @Public()
  @ApiOperation({ summary: 'Send OTP' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.customerService.sendOtp(dto);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Customer login' })
  @ApiBody({ type: LoginDto })
  login(@Body() dto: LoginDto) {
    return this.customerService.login(dto);
  }

  @Post('login-with-otp/by-email')
  @Public()
  @ApiOperation({ summary: 'Customer login' })
  @ApiBody({ type: VerifyEmailOtpDto })
  loginWithOtpByEmail(@Body() dto: VerifyEmailOtpDto) {
    return this.customerService.loginWithOtpByEmail(dto);
  }

  @Post('login-with-otp/by-phone')
  @Public()
  @ApiOperation({ summary: 'Customer login' })
  @ApiBody({ type: VerifyPhoneOtpDto })
  loginWithOtpByPhone(@Body() dto: VerifyPhoneOtpDto) {
    return this.customerService.loginWithOtpByPhone(dto);
  }

  @Post('/email/otp-verification')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Customer Email OTP verification' })
  @ApiBody({ type: VerifyEmailOtpDto })
  emailVerify(@CurrentUser() user: JwtUser, @Body() dto: VerifyEmailOtpDto) {
    return this.customerService.verifyOtpByEmail(user, dto);
  }

  @Post('/phone/otp-verification')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Franchise Phone OTP verification' })
  @ApiBody({ type: VerifyPhoneOtpDto })
  phoneVerify(@CurrentUser() user: JwtUser, @Body() dto: VerifyPhoneOtpDto) {
    return this.customerService.verifyOtpByPhone(user, dto);
  }

  @Post('refresh-token')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Refresh access token' })
  refreshToken(@CurrentUser() user: JwtUser, @Body() dto: RefreshTokenDto) {
    return this.customerService.refreshToken(user, dto);
  }

  @Patch('/change-password')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'To change password' })
  changePassword(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChangePasswordDto,
    @Ip() ip: string,
  ) {
    return this.customerService.changePassword(user, dto, ip);
  }

  @Post('/:email/forgot-password')
  @Public()
  @ApiOperation({ summary: 'Forgot Password' })
  async forgot_password_otp(@Param('email') email: string) {
    return this.customerService.forgotPasswordViaEmail(email);
  }

  @Patch('reset-password/:email')
  @Public()
  @ApiOperation({ summary: 'Reset password' })
  @ApiBody({ type: ResetPasswordWithOtpDto })
  async resetPassword(
    @Param('email') email: string,
    @Body() dto: ResetPasswordWithOtpDto,
  ) {
    const data = await this.customerService.resetPasswordViaEmail({
      ...dto,
      email,
    });
    return { data, message: 'Password reset successfully' };
  }

  @Post('/:email/forgot-password/via-token')
  @Public()
  @ApiOperation({ summary: 'Forgot Password' })
  forgot_password(@Param('email') email: string) {
    return this.customerService.forgotPasswordViaEmailViaToken(email);
  }

  @Patch('reset-password/via-token')
  @Public()
  @ApiOperation({ summary: 'Reset password' })
  @ApiBody({ type: ResetPasswordDto })
  resetPasswordViaToken(@Body() dto: ResetPasswordDto) {
    return this.customerService.resetPasswordViaEmailViaToken(dto);
  }

  @Post('logout')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Logout user' })
  logOut(@CurrentUser() user: JwtUser) {
    return this.customerService.logOut(user.sub);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Get current profile' })
  get_me(@CurrentUser() user: JwtUser) {
    console.log('Current user:', user);
    return this.customerService.findOne(user.sub);
  }

  //   @Get('me/inventory/reorder-suggestions')
  //   @ApiBearerAuth('access-token')
  //   @ApiOperation({ summary: 'Get reorder suggestions for franchise inventory' })
  //   @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  //   meReorderSuggestions(@CurrentUser() user: JwtUser) {
  //     return this.franchiseService.reorderSuggestionsForFranchise(
  //       user.franchiseId,
  //     );
  //   }

  @Patch('profile-update')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Update customer profile' })
  @ApiBody({ type: UpdateCustomerDto })
  update(@CurrentUser() user: JwtUser, @Body() dto: UpdateCustomerDto) {
    return this.customerService.update(user.sub, dto);
  }

  @Patch('account-recovery')
  @Public()
  @ApiOperation({ summary: 'Update customer account recovery' })
  @ApiBody({ type: RecoveryDto })
  accountRecovery(@Body() dto: RecoveryDto) {
    return this.customerService.accountRecovery(dto);
  }

  @Delete('de-register')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'To deactivate the profile' })
  softDelete(@CurrentUser() user: JwtUser, @Ip() ip: string) {
    return this.customerService.softDelete(user, ip);
  }
}
