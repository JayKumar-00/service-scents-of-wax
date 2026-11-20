import { Injectable } from '@nestjs/common';
import { SurepassProvider } from './providers/surepass.provider';

@Injectable()
export class IdentityVerificationService {
  constructor(private readonly provider: SurepassProvider) {}

  async panVerification(idNumber: string): Promise<any> {
    return this.provider.panVerification(idNumber);
  }

  async aadhaarValidation(idNumber: string): Promise<any> {
    return this.provider.aadhaarValidation(idNumber);
  }

  async generateOtp(idNumber: string): Promise<any> {
    return this.provider.generateOtp(idNumber);
  }

  async submitOtp(clientId: string, otp: string): Promise<any> {
    return this.provider.submitOtp(clientId, otp);
  }

  async bankVerification(
    idNumber: string,
    ifsc: string,
    ifscDetails: boolean,
  ): Promise<any> {
    return this.provider.bankVerification(idNumber, ifsc, ifscDetails);
  }

  async upiVerification(upiId: string): Promise<any> {
    return this.provider.upiVerification(upiId);
  }

  async voterIdVerification(idNumber: string): Promise<any> {
    return this.provider.voterIdVerification(idNumber);
  }

  async drivingLicenseVerification(
    idNumber: string,
    dob: string,
  ): Promise<any> {
    return this.provider.drivingLicenseVerification(idNumber, dob);
  }

  async passportVerification(clientId: string): Promise<any> {
    return this.provider.passportVerification(clientId);
  }

  async gstinVerification(idNumber: string): Promise<any> {
    return this.provider.gstinVerification(idNumber);
  }

  async gstAdvanceVerification(idNumber: string): Promise<any> {
    return this.provider.gstAdvanceVerification(idNumber);
  }

  async irnVerification(
    fileBuffer: Buffer,
    fileName: string,
    fileMime: string,
    usePdf: string,
  ): Promise<any> {
    return this.provider.irnVerification(
      fileBuffer,
      fileName,
      fileMime,
      usePdf,
    );
  }

  async faceMatch(
    selfieBuffer: Buffer,
    selfieName: string,
    selfieMime: string,
    idCardBuffer: Buffer,
    idCardName: string,
    idCardMime: string,
  ): Promise<any> {
    return this.provider.faceMatch(
      selfieBuffer,
      selfieName,
      selfieMime,
      idCardBuffer,
      idCardName,
      idCardMime,
    );
  }
}
