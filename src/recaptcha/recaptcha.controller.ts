import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RecaptchaService } from './recaptcha.service';

@ApiTags('reCAPTCHA Verification')
@Controller('recaptcha')
export class RecaptchaController {
  constructor(private readonly recaptchaService: RecaptchaService) {}

  @Get('config')
  @Public()
  @ApiOperation({ summary: 'Get public reCAPTCHA site key configuration' })
  async config() {
    return {
      siteKey: this.recaptchaService.getSiteKey(),
    };
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Google reCAPTCHA token' })
  @ApiHeader({
    name: 'x-recaptcha-token',
    required: false,
    description:
      'reCAPTCHA token from the frontend client (alternative to body)',
  })
  @ApiResponse({ status: 200, description: 'Token verified successfully' })
  @ApiResponse({ status: 400, description: 'Token verification failed' })
  async verify(
    @Ip() ip: string,
    @Headers('x-recaptcha-token') headerToken?: string,
    @Body('captchaToken') bodyToken?: string,
  ) {
    const token = headerToken || bodyToken;
    if (!token) {
      throw new BadRequestException('reCAPTCHA token is required');
    }

    const isValid = await this.recaptchaService.validateToken(token, ip);
    if (!isValid) {
      throw new BadRequestException('reCAPTCHA verification failed');
    }

    return {
      success: true,
      message: 'reCAPTCHA verification succeeded',
    };
  }
}
