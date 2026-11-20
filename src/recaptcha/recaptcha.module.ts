import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecaptchaService } from './recaptcha.service';
import { RecaptchaController } from './recaptcha.controller';
import { RecaptchaProvider } from './providers/recaptcha.provider';

@Module({
  imports: [ConfigModule],
  controllers: [RecaptchaController],
  providers: [RecaptchaService, RecaptchaProvider],
  exports: [RecaptchaService, RecaptchaProvider],
})
export class RecaptchaModule {}
