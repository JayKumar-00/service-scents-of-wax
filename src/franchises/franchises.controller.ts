import { Controller } from '@nestjs/common';
// import type { Request } from 'express';
// import { Role } from '@prisma/client';
// import { CurrentUser } from '../common/decorators/current-user.decorator';
// import { Roles } from '../common/decorators/roles.decorator';
// import { JwtUser } from '../auth/types/jwt-user.type';
// import { CreateFranchiseDto } from './dto/create-franchise.dto';
// import { UpdateFranchiseDto } from './dto/update-franchise.dto';
// import { FranchisesService } from './franchises.service';

@Controller('franchises')
export class FranchisesController {
  // constructor(private readonly franchises: FranchisesService) {}
  // @Get()
  // @Roles(Role.SUPERADMIN)
  // list() {
  //   return this.franchises.list();
  // }
  // @Post()
  // @Roles(Role.SUPERADMIN)
  // create(
  //   @Body() dto: CreateFranchiseDto,
  //   @CurrentUser() user: JwtUser,
  //   @Req() req: Request,
  // ) {
  //   const ip =
  //     (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
  //     req.ip;
  //   return this.franchises.create(dto, { userId: user.sub, ip });
  // }
  // @Get('me/inventory/reorder-suggestions')
  // @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  // meReorderSuggestions(@CurrentUser() user: JwtUser) {
  //   return this.franchises.reorderSuggestionsForFranchise(user.franchiseId);
  // }
  // @Get('me/inventory')
  // @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  // meInventory(@CurrentUser() user: JwtUser) {
  //   return this.franchises.inventoryForFranchise(user.franchiseId);
  // }
  // @Get('me')
  // @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF, Role.FRANCHISE_AUDITOR)
  // me(@CurrentUser() user: JwtUser) {
  //   return this.franchises.getForFranchiseUser(user.franchiseId);
  // }
  // @Patch(':id')
  // @Roles(Role.SUPERADMIN)
  // update(
  //   @Param('id') id: string,
  //   @Body() dto: UpdateFranchiseDto,
  //   @CurrentUser() user: JwtUser,
  //   @Req() req: Request,
  // ) {
  //   const ip =
  //     (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
  //     req.ip;
  //   return this.franchises.update(id, dto, { userId: user.sub, ip });
  // }
}
