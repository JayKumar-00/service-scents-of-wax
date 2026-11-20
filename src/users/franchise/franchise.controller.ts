import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { FranchiseProfileUpdateDto } from './dto/update-franchise.dto';
import { RegisterFranchiseDto } from './dto/register-franchise.dto';
import { FranchiseService } from './franchise.service';
import {
  ChangePasswordDto,
  LoginDto,
  RecoveryDto,
  RefreshTokenDto,
  VerifyEmailOtpDto,
  VerifyPhoneOtpDto,
} from 'src/auth/dto/user.dto';
import {
  ResetPasswordDto,
  ResetPasswordWithOtpDto,
} from 'src/auth/dto/reset-password.dto';
import { SendOtpDto } from 'src/otp/dto/send-otp.dto';
import { FranchiseInventoryQueryDto } from './dto/franchise-inventory-query.dto';

@ApiTags('Franchise Authentication')
@Controller('franchise-auth')
export class FranchiseController {
  constructor(private readonly franchiseService: FranchiseService) { }

  // @Post('auth/firebase')
  // @Public()
  // @ApiOperation({ summary: 'Login with Google / Facebook via Firebase' })
  // firebaseAuth(@Body('token') token: string) {
  //   return this.franchiseService.firebaseAuth(token);
  // }

  @Post('via/:phone(\\d{10,12})/otp')
  @Public()
  @ApiOperation({ summary: 'OTP sent (Registration) Ex: 91998177XXX1' })
  sendOtpSms(@Param('phone') phone: string) {
    return this.franchiseService.sendOtpSms(phone);
  }

  @Post('/:email/otp')
  @Public()
  @ApiOperation({ summary: 'OTP sent (Registration)' })
  sendEmailOtp(@Param('email') email: string) {
    return this.franchiseService.sendOtpEmail(email);
  }

  @Post('/email/registration')
  // @UseGuards(OtpRateLimitGuard)
  @Public()
  @ApiOperation({
    summary: 'Franchise Email OTP verification for registration',
  })
  @ApiBody({ type: RegisterFranchiseDto })
  registrationViaEmail(@Body() dto: RegisterFranchiseDto) {
    return this.franchiseService.registrationByEmail(dto);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Franchise login' })
  @ApiBody({ type: LoginDto })
  login(@Body() dto: LoginDto) {
    return this.franchiseService.login(dto);
  }

  @Post('send-otp-login')
  @Public()
  @ApiOperation({ summary: 'Send OTP' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.franchiseService.sendOtp(dto);
  }

  @Post('login-with-otp/by-email')
  @Public()
  @ApiOperation({ summary: 'Franchise login' })
  @ApiBody({ type: VerifyEmailOtpDto })
  loginWithOtpByEmail(@Body() dto: VerifyEmailOtpDto) {
    return this.franchiseService.loginWithOtpByEmail(dto);
  }

  @Post('login-with-otp/by-phone')
  @Public()
  @ApiOperation({ summary: 'Franchise login' })
  @ApiBody({ type: VerifyPhoneOtpDto })
  loginWithOtpByPhone(@Body() dto: VerifyPhoneOtpDto) {
    return this.franchiseService.loginWithOtpByPhone(dto);
  }

  @Post('/email/otp-verification')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  @ApiOperation({ summary: 'Franchise Email OTP verification' })
  @ApiBody({ type: VerifyEmailOtpDto })
  emailVerify(@CurrentUser() user: JwtUser, @Body() dto: VerifyEmailOtpDto) {
    return this.franchiseService.verifyOtpByEmail(user, dto);
  }

  @Post('/phone/otp-verification')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  @ApiOperation({ summary: 'Franchise Phone OTP verification' })
  @ApiBody({ type: VerifyPhoneOtpDto })
  phoneVerify(@CurrentUser() user: JwtUser, @Body() dto: VerifyPhoneOtpDto) {
    return this.franchiseService.verifyOtpByPhone(user, dto);
  }

  @Post('refresh-token')
  @ApiBearerAuth('access-token')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.franchiseService.refreshToken(dto.userId, dto.refreshToken);
  }

  @Patch('/change-password')
  @ApiBearerAuth('access-token')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  @ApiOperation({ summary: 'To change password' })
  changePassword(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChangePasswordDto,
    @Ip() ip: string,
  ) {
    return this.franchiseService.changePassword(user, dto, ip);
  }

  @Post('/:email/forgot-password')
  @Public()
  @ApiOperation({ summary: 'Franchise Forgot Password' })
  async forgot_password_otp(@Param('email') email: string) {
    return this.franchiseService.forgotPasswordViaEmail(email);
  }

  @Patch('reset-password/:email')
  @Public()
  @ApiOperation({ summary: 'Reset Franchise password' })
  @ApiBody({ type: ResetPasswordWithOtpDto })
  async resetPassword(
    @Param('email') email: string,
    @Body() dto: ResetPasswordWithOtpDto,
  ) {
    const data = await this.franchiseService.resetPasswordViaEmail({
      ...dto,
      email,
    });
    return { data, message: 'Password reset successfully' };
  }

  @Post('/:email/forgot-password/via-token')
  @Public()
  @ApiOperation({ summary: 'Franchise Forgot Password' })
  forgot_password(@Param('email') email: string) {
    return this.franchiseService.forgotPasswordViaEmailViaToken(email);
  }

  @Patch('reset-password/via-token')
  @Public()
  @ApiOperation({ summary: 'Reset Franchise password' })
  @ApiBody({ type: ResetPasswordDto })
  resetPasswordViaToken(@Body() dto: ResetPasswordDto) {
    return this.franchiseService.resetPasswordViaEmailViaToken(dto);
  }

  @Post('logout')
  @ApiBearerAuth('access-token')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  @ApiOperation({ summary: 'Logout user' })
  logOut(@CurrentUser() user: JwtUser, @Ip() ip: string) {
    return this.franchiseService.logOut(user, ip);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  @ApiOperation({ summary: 'Get current Franchise profile' })
  get_me(@CurrentUser() user: JwtUser) {
    return this.franchiseService.getMe(user);
  }

  // @Get('me/inventory/reorder-suggestions')
  // @ApiBearerAuth('access-token')
  // @ApiOperation({ summary: 'Get reorder suggestions for franchise inventory' })
  // @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  // meReorderSuggestions(@CurrentUser() user: JwtUser) {
  //   return this.franchiseService.reorderSuggestionsForFranchise(
  //     user.franchiseId
  //       ? user.franchiseId
  //       : user.franchiseOwnerId
  //         ? user.franchiseOwnerId
  //         : null,
  //   );
  // }

  @Get('me/inventory')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Retrieve franchise inventory including stock levels, product details, and pending inbound deliveries',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  meInventory(
    @CurrentUser() user: JwtUser,
    @Query() query: FranchiseInventoryQueryDto,
  ) {
    return this.franchiseService.inventories({
      ...query,
      ...(user.role === Role.FRANCHISE_OWNER
        ? { franchiseId: user.franchiseId }
        : {}),
      ...(user.role === Role.FRANCHISE_STAFF
        ? { franchiseId: user.franchiseOwnerId }
        : {}),
    });
  }

  // @Get('me/inventory/products')
  // @ApiBearerAuth('access-token')
  // @ApiOperation({
  //   summary:
  //     'Retrieve franchise inventory in a format identical to the public web product catalog',
  // })
  // @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  // meInventoryProducts(
  //   @CurrentUser() user: JwtUser,
  //   @Query() query: FranchiseInventoryQueryDto,
  // ) {
  //   return this.franchiseService.inventoryProducts({
  //     ...query,
  //     ...(user.role === Role.FRANCHISE_OWNER
  //       ? { franchiseId: user.franchiseId }
  //       : {}),
  //     ...(user.role === Role.FRANCHISE_STAFF
  //       ? { franchiseId: user.franchiseOwnerId }
  //       : {}),
  //   });
  // }

  @Get('me/inventory/products/:productId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Retrieve a single franchise inventory product in a format identical to the public web product catalog',
  })
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  meInventoryProduct(
    @CurrentUser() user: JwtUser,
    @Param('productId') productId: string,
  ) {
    const franchiseId =
      user.role === Role.FRANCHISE_OWNER
        ? user.franchiseId
        : user.franchiseOwnerId;

    if (!franchiseId) {
      throw new BadRequestException('Franchise ID not found for user');
    }

    return this.franchiseService.inventoryProduct(franchiseId, productId);
  }

  @Patch('profile-update')
  @ApiBearerAuth('access-token')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Update Franchise profile' })
  @ApiBody({ type: FranchiseProfileUpdateDto })
  update(
    @CurrentUser() user: JwtUser,
    @Body() dto: FranchiseProfileUpdateDto,
    @Ip() ip: string,
  ) {
    return this.franchiseService.update(user, dto, ip);
  }

  @Patch('account-recovery')
  @Public()
  @ApiOperation({ summary: 'Update franchise account recovery' })
  @ApiBody({ type: RecoveryDto })
  accountRecovery(@Body() dto: RecoveryDto, @Ip() ip: string) {
    return this.franchiseService.accountRecovery(dto, ip);
  }

  @Delete('de-register')
  @ApiBearerAuth('access-token')
  @Roles(Role.FRANCHISE_OWNER)
  @ApiOperation({ summary: 'Softly deleted franchise profile' })
  softDelete(@CurrentUser() user: JwtUser, @Ip() ip: string) {
    return this.franchiseService.softDelete(user, ip);
  }
}
