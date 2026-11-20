import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtUser } from '../../../auth/types/jwt-user.type';
import { CreateCreditNoteDto } from '../dto/credit-note.dto';
import { CreditNoteService } from '../services/credit-note.service';

@ApiTags('Returns Financial - Credit Notes & Ledger')
@ApiBearerAuth('access-token')
@Controller()
export class CreditNoteController {
  // constructor(private readonly creditNoteService: CreditNoteService) {}
  // @Post('invoices/:invoiceNumber/credit-note')
  // @ApiOperation({
  //   summary:
  //     'Generate a Credit Note for a return request, linked to a payment invoice',
  // })
  // @ApiCreatedResponse({ description: 'Credit Note generated successfully' })
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_OWNER)
  // async createCreditNote(
  //   @Param('invoiceNumber') invoiceNumber: string,
  //   @Body() dto: CreateCreditNoteDto,
  //   @CurrentUser() user: JwtUser,
  // ) {
  //   return this.creditNoteService.createCreditNote(invoiceNumber, dto, user);
  // }
  // @Get('credit-notes')
  // @ApiOperation({
  //   summary: 'List all generated Credit Notes',
  // })
  // @ApiOkResponse({ description: 'List of Credit Notes retrieved successfully' })
  // @Roles(
  //   Role.SUPERADMIN,
  //   Role.ADMIN_STAFF,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_AUDITOR,
  // )
  // async listCreditNotes(@CurrentUser() user: JwtUser) {
  //   return this.creditNoteService.listCreditNotes(user);
  // }
  // @Get('credit-notes/:id')
  // @ApiOperation({
  //   summary: 'Get details of a single Credit Note',
  // })
  // @ApiOkResponse({ description: 'Credit Note details retrieved successfully' })
  // @Roles(
  //   Role.SUPERADMIN,
  //   Role.ADMIN_STAFF,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_AUDITOR,
  // )
  // async getCreditNote(@Param('id') id: string) {
  //   return this.creditNoteService.getCreditNote(id);
  // }
  // @Get('invoices/:id/ledger')
  // @ApiOperation({
  //   summary: 'Get the consolidated financial ledger for a Payment Invoice',
  // })
  // @ApiOkResponse({ description: 'Consolidated ledger retrieved successfully' })
  // @Roles(
  //   Role.SUPERADMIN,
  //   Role.ADMIN_STAFF,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_AUDITOR,
  // )
  // async getLedger(@Param('id') id: string) {
  //   return this.creditNoteService.getLedger(id);
  // }
}
