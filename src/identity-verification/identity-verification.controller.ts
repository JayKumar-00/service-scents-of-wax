import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { IdentityVerificationService } from './identity-verification.service';
import {
  AadhaarValidationDto,
  BankVerificationDto,
  DrivingLicenseVerificationDto,
  FaceMatchDto,
  GenerateOtpDto,
  GstAdvanceVerificationDto,
  GstinVerificationDto,
  IrnVerificationDto,
  PanVerificationDto,
  PassportVerificationDto,
  SubmitOtpDto,
  UpiVerificationDto,
  VoterIdVerificationDto,
} from './dto/identity-verification.dto';

@ApiTags('Identity Verification')
@ApiBearerAuth('access-token')
@Controller()
export class IdentityVerificationController {
  constructor(private readonly service: IdentityVerificationService) {}

  @Post('pan/pan-only')
  @ApiOperation({ summary: 'Verify PAN number' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'PAN verification result',
  })
  panVerification(@Body() dto: PanVerificationDto) {
    return this.service.panVerification(dto.id_number);
  }

  @Post('aadhaar-validation/aadhaar-validation')
  @ApiOperation({ summary: 'Verify Aadhaar validation details' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Aadhaar validation result',
  })
  aadhaarValidation(@Body() dto: AadhaarValidationDto) {
    return this.service.aadhaarValidation(dto.id_number);
  }

  @Post('aadhaar-v2/generate-otp')
  @ApiOperation({ summary: 'Generate Aadhaar OTP' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Aadhaar OTP generation result',
  })
  generateOtp(@Body() dto: GenerateOtpDto) {
    return this.service.generateOtp(dto.id_number);
  }

  @Post('aadhaar-v2/submit-otp')
  @ApiOperation({ summary: 'Submit Aadhaar OTP' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Aadhaar OTP submission result',
  })
  submitOtp(@Body() dto: SubmitOtpDto) {
    return this.service.submitOtp(dto.client_id, dto.otp);
  }

  @Post('bank-verification')
  @ApiOperation({ summary: 'Verify Bank Account Details' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bank verification result',
  })
  bankVerification(@Body() dto: BankVerificationDto) {
    return this.service.bankVerification(
      dto.id_number,
      dto.ifsc,
      dto.ifsc_details ?? true,
    );
  }

  @Post('bank-verification/upi-verification')
  @ApiOperation({ summary: 'Verify UPI ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'UPI verification result',
  })
  upiVerification(@Body() dto: UpiVerificationDto) {
    return this.service.upiVerification(dto.upi_id);
  }

  @Post('voter-id/voter-id')
  @ApiOperation({ summary: 'Verify Voter ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Voter ID verification result',
  })
  voterIdVerification(@Body() dto: VoterIdVerificationDto) {
    return this.service.voterIdVerification(dto.id_number);
  }

  @Post('driving-license/driving-license')
  @ApiOperation({ summary: 'Verify Driving License' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Driving License verification result',
  })
  drivingLicenseVerification(@Body() dto: DrivingLicenseVerificationDto) {
    return this.service.drivingLicenseVerification(dto.id_number, dto.dob);
  }

  @Post('passport/passport/verify')
  @ApiOperation({ summary: 'Verify Passport' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Passport verification result',
  })
  passportVerification(@Body() dto: PassportVerificationDto) {
    return this.service.passportVerification(dto.client_id);
  }

  @Post('corporate/gstin')
  @ApiOperation({ summary: 'Verify GSTIN' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'GSTIN verification result',
  })
  gstinVerification(@Body() dto: GstinVerificationDto) {
    return this.service.gstinVerification(dto.id_number);
  }

  @Post('corporate/gstin-advanced')
  @ApiOperation({ summary: 'Verify GSTIN (Advanced)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'GSTIN Advanced verification result',
  })
  gstAdvanceVerification(@Body() dto: GstAdvanceVerificationDto) {
    return this.service.gstAdvanceVerification(dto.id_number);
  }

  @Post('corporate/einvoice-irn')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Verify E-Invoice IRN' })
  @ApiResponse({ status: HttpStatus.OK, description: 'E-Invoice IRN result' })
  @ApiBody({ type: IrnVerificationDto })
  irnVerification(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: IrnVerificationDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.service.irnVerification(
      file.buffer,
      file.originalname,
      file.mimetype,
      dto.use_pdf,
    );
  }

  @Post('face/face-match')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'selfie', maxCount: 1 },
      { name: 'id_card', maxCount: 1 },
    ]),
  )
  @ApiOperation({ summary: 'Perform Face Match' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Face match verification result',
  })
  @ApiBody({ type: FaceMatchDto })
  faceMatch(
    @UploadedFiles()
    files: {
      selfie?: Express.Multer.File[];
      id_card?: Express.Multer.File[];
    },
    @Body() dto: FaceMatchDto,
  ) {
    if (!files.selfie?.[0] || !files.id_card?.[0]) {
      throw new BadRequestException(
        'Both selfie and id_card files are required',
      );
    }
    return this.service.faceMatch(
      files.selfie[0].buffer,
      files.selfie[0].originalname,
      files.selfie[0].mimetype,
      files.id_card[0].buffer,
      files.id_card[0].originalname,
      files.id_card[0].mimetype,
    );
  }
}
