import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { CreateFranchiseDocumentDto } from './dto/create-franchise-document.dto';
import { FranchiseDocumentsService } from './franchise-documents.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Franchise Documents <- Superadmin / Franchise Users')
@ApiBearerAuth('access-token')
@Controller('franchise-documents')
export class FranchiseDocumentsController {
  // constructor(private readonly docs: FranchiseDocumentsService) {}
  // @Get()
  // @Roles(
  //   Role.SUPERADMIN,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_STAFF,
  //   Role.FRANCHISE_AUDITOR,
  // )
  // list(
  //   @CurrentUser() user: JwtUser,
  //   @Query('franchiseId') franchiseId?: string,
  // ) {
  //   return this.docs.list(user, franchiseId);
  // }
  // @Post()
  // @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  // create(
  //   @Body() dto: CreateFranchiseDocumentDto,
  //   @CurrentUser() user: JwtUser,
  // ) {
  //   return this.docs.create(dto, user);
  // }
  // @Patch(':id/verify')
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  // verify(@Param('id') id: string, @CurrentUser() user: JwtUser) {
  //   return this.docs.verify(id, user);
  // }
}
