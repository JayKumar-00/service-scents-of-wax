import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpStatus,
  Ip,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { UserKycService } from './user-kyc.service';
import {
  VerifyUserKycDto,
  CreateUserKycDto,
  UpdateUserKycDto,
} from './dto/user-kyc.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@ApiTags('User KYC Management')
@ApiBearerAuth('access-token')
@Controller('user-kyc')
export class UserKycController {
  constructor(private readonly service: UserKycService) {}

  @Post()
  @ApiOperation({
    summary: 'Verify KYC document and optionally save/update KYC status in DB',
    description: `
**Supported Document Types & Required Payload Fields:**
- **AADHAAR**: Requires \`id_number\` (Aadhaar number)
- **PAN**: Requires \`id_number\` (PAN number)
- **VOTER_ID**: Requires \`id_number\` (Voter ID number)
- **GSTIN**: Requires \`id_number\` (GSTIN number)
- **UPI**: Requires \`id_number\` (UPI ID)
- **BANK**: Requires \`id_number\` (Bank Account Number), \`ifsc\` (IFSC Code), and optional \`ifsc_details\` (boolean)
- **DRIVING_LICENSE**: Requires \`id_number\` (Driving License Number) and \`dob\` (Date of Birth in YYYY-MM-DD)
- **PASSPORT**: Requires \`id_number\` (Passport Client ID)

**Database Storage Options:**
- Pass \`isSaveDB: true\` and a valid user \`email\` in the request body to save or update the KYC record in the database linked to that user.
- If \`isSaveDB\` is false or not provided, the validation response is returned without creating a database entry.

**Example Request Payload (BANK):**
\`\`\`json
{
  "documentType": "BANK",
  "id_number": "219101000000000",
  "ifsc": "BARB0DAMOHA",
  "ifsc_details": true,
  "email": "user@example.com",
  "isSaveDB": true
}
\`\`\`
`,
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Verification result' })
  verifyKyc(
    @CurrentUser() user: JwtUser,
    @Body() dto: VerifyUserKycDto,
    @Ip() ip: string,
  ) {
    return this.service.verifyKyc(user, dto, ip);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Manually create User KYC record' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User KYC record created',
  })
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateUserKycDto,
    @Ip() ip: string,
  ) {
    return this.service.create(user, dto, ip);
  }

  @Get()
  @ApiOperation({ summary: 'Get all User KYC records' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of User KYC records',
  })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get User KYC record by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User KYC record' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get('by-email/:email')
  @ApiOperation({ summary: 'Get User KYC record by user email' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User KYC record' })
  findByEmail(@Param('email') email: string) {
    return this.service.findByEmail(email);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update User KYC record' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated User KYC record',
  })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserKycDto,
    @Ip() ip: string,
  ) {
    return this.service.update(user, id, dto, ip);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete User KYC record' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User KYC record deleted',
  })
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.service.remove(user, id, ip);
  }
}
