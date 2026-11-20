import { Module } from '@nestjs/common';
import { IdentityVerificationController } from './identity-verification.controller';
import { IdentityVerificationService } from './identity-verification.service';
import { SurepassProvider } from './providers/surepass.provider';
import { UserKycController } from './user-kyc.controller';
import { UserKycService } from './user-kyc.service';
import { AuditModule } from 'src/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [IdentityVerificationController, UserKycController],
  providers: [IdentityVerificationService, SurepassProvider, UserKycService],
  exports: [IdentityVerificationService, UserKycService],
})
export class IdentityVerificationModule {}
