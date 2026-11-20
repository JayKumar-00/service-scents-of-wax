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
import { CreateExchangeMemoDto } from '../dto/exchange-memo.dto';
import { ExchangeExtensionService } from '../services/exchange-extension.service';

@ApiTags('Returns Financial - Exchanges')
@ApiBearerAuth('access-token')
@Controller()
export class ExchangeExtensionController {
  // constructor(private readonly exchangeService: ExchangeExtensionService) {}
  // @Post('returns-v2/:id/exchange-memo')
  // @ApiOperation({
  //   summary:
  //     'Generate Exchange Memo / Receipt and process lower/higher-value flows',
  // })
  // @ApiCreatedResponse({
  //   description: 'Exchange memo/receipt created successfully',
  // })
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_OWNER)
  // async createExchangeMemo(
  //   @Param('id') returnRequestId: string,
  //   @Body() dto: CreateExchangeMemoDto,
  //   @CurrentUser() user: JwtUser,
  // ) {
  //   return this.exchangeService.createExchangeMemo(returnRequestId, dto, user);
  // }
  // @Get('exchange-memos')
  // @ApiOperation({
  //   summary: 'List all generated Exchange Memos',
  // })
  // @ApiOkResponse({
  //   description: 'List of exchange memos retrieved successfully',
  // })
  // @Roles(
  //   Role.SUPERADMIN,
  //   Role.ADMIN_STAFF,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_AUDITOR,
  // )
  // async listExchangeMemos() {
  //   return this.exchangeService.listExchangeMemos();
  // }
  // @Get('exchange-memos/:id')
  // @ApiOperation({
  //   summary: 'Get details of a single Exchange Memo',
  // })
  // @ApiOkResponse({
  //   description: 'Exchange memo details retrieved successfully',
  // })
  // @Roles(
  //   Role.SUPERADMIN,
  //   Role.ADMIN_STAFF,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_AUDITOR,
  // )
  // async getExchangeMemo(@Param('id') id: string) {
  //   return this.exchangeService.getExchangeMemo(id);
  // }
  // @Get('exchange-receipts/:id')
  // @ApiOperation({
  //   summary: 'Get details of a single Exchange Receipt',
  // })
  // @ApiOkResponse({
  //   description: 'Exchange receipt details retrieved successfully',
  // })
  // @Roles(
  //   Role.SUPERADMIN,
  //   Role.ADMIN_STAFF,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_AUDITOR,
  // )
  // async getExchangeReceipt(@Param('id') id: string) {
  //   return this.exchangeService.getExchangeReceipt(id);
  // }
}
