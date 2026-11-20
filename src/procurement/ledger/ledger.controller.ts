import { Controller, Get, Query, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtUser } from '../../auth/types/jwt-user.type';
import { LedgerService } from './ledger.service';
import { LedgerQueryDto, SupplierLedgerQueryDto, FranchiseLedgerQueryDto } from './dto/ledger-query.dto';

@ApiTags('Procurement Ledger')
@ApiBearerAuth('access-token')
@Controller('procurement/ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Get all inventory ledger entries including references to stock requests, returns, and remaining balances.',
  })
  async list(@Query() query: LedgerQueryDto) {
    return this.ledgerService.list(query);
  }

  @Get('me')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  @ApiOperation({
    summary: 'Get own inventory ledger entries for a franchise user.',
  })
  async listForFranchise(
    @CurrentUser() user: JwtUser,
    @Query() query: LedgerQueryDto
  ) {
    const franchiseId = user.role === Role.FRANCHISE_OWNER ? user.franchiseId : user.franchiseOwnerId;
    if (!franchiseId) {
      throw new ForbiddenException('User is not associated with a franchise');
    }
    return this.ledgerService.listForFranchise(franchiseId, query);
  }

  @Get('supplier')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Get ledger grouped by suppliers, including their POs, items, ASNs, GRNs, QCs.',
  })
  async listSupplierLedger(@Query() query: SupplierLedgerQueryDto) {
    return this.ledgerService.listSupplierLedger(query);
  }

  @Get('franchise')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  @ApiOperation({
    summary: 'Get franchise ledger. If franchiseId is provided, returns single franchise details with paginated & filtered stock requests.',
  })
  async listFranchiseLedgerGrouped(
    @CurrentUser() user: JwtUser,
    @Query() query: FranchiseLedgerQueryDto
  ) {
    // If the user is a franchise, they can only view their own ledger
    let userFranchiseId: string | undefined;
    if (
      user.role === Role.FRANCHISE_OWNER ||
      user.role === Role.FRANCHISE_STAFF ||
      user.role === Role.FRANCHISE_AUDITOR
    ) {
      userFranchiseId = user.role === Role.FRANCHISE_OWNER ? user.franchiseId : user.franchiseOwnerId;
      if (!userFranchiseId) {
        throw new ForbiddenException('User is not associated with a franchise');
      }
    }
    
    return this.ledgerService.listFranchiseLedger(query, userFranchiseId);
  }
}
