import {
  Prisma,
  PrismaClient,
  Role,
  KycStatus,
  FranchiseStatus,
  StockRequestStatus,
  StockRequestPaymentStatus,
  OrderStatus,
  OrderChannel,
  OnlinePaymentStatus,
  DeliveryStatus,
  NoticeAudience,
  SupportTicketType,
  SupportTicketStatus,
  TicketPriority,
  FranchiseDocumentKind,
  FranchiseReturnStatus,
  StockingNodeType,
  PaymentModeEnum,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const backupImageUrls: string[] = [];

function getBackupImage(index: number): string {
  if (backupImageUrls.length > 0) {
    return backupImageUrls[index % backupImageUrls.length];
  }
  return 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=800';
}

function clampInt(val: any, defaultVal = 0): number {
  if (val === null || val === undefined) return defaultVal;
  const num = typeof val === 'number' ? Math.floor(val) : parseInt(String(val), 10);
  if (isNaN(num)) return defaultVal;
  if (num > 2147483647) return 2147483647;
  if (num < -2147483648) return -2147483648;
  return num;
}

export async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Extract actual view images from backups at start
  try {
    const pPath = path.join(process.cwd(), 'backups', 'mvs.products.json');
    const vPath = path.join(process.cwd(), 'backups', 'mvs.productvariants.json');
    if (fs.existsSync(pPath)) {
      const pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
      for (const p of pData) {
        if (p.baseImageUrl) {
          for (const img of p.baseImageUrl) {
            if (img && typeof img === 'string' && img.startsWith('http') && !img.includes('placeholder')) {
              if (!backupImageUrls.includes(img)) backupImageUrls.push(img);
            }
          }
        }
      }
    }
    if (fs.existsSync(vPath)) {
      const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
      for (const v of vData) {
        if (v.images) {
          for (const img of v.images) {
            if (img && typeof img === 'string' && img.startsWith('http') && !img.includes('placeholder')) {
              if (!backupImageUrls.includes(img)) backupImageUrls.push(img);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error extracting backup images:', e);
  }
  console.log(`Extracted ${backupImageUrls.length} actual view images from backups.`);

  const adminFranchise = await prisma.franchise.upsert({
    where: { code: 'ADMIN-HQ' },
    update: {
      name: 'Admin HQ Franchise',
      status: FranchiseStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
    },
    create: {
      name: 'Admin HQ Franchise',
      code: 'ADMIN-HQ',
      status: FranchiseStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
      latitude: 12.9716,
      longitude: 77.5946,
      addressLine1: 'Admin HQ Center',
      city: 'HQ',
      postalCode: '000000',
      country: 'IN',
    },
  });

  const centralWarehouseFranchise = await prisma.franchise.upsert({
    where: { code: 'CENTRAL_WAREHOUSE' },
    update: {
      name: 'Central Warehouse',
      status: FranchiseStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
    },
    create: {
      name: 'Central Warehouse',
      code: 'CENTRAL_WAREHOUSE',
      status: FranchiseStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
      latitude: 12.9716,
      longitude: 77.5946,
      addressLine1: 'Central Fulfillment Center',
      city: 'HQ',
      postalCode: '000000',
      country: 'INDIA',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@giftfactory.local' },
    update: {
      passwordHash,
      franchiseId: adminFranchise.id,
      franchiseOwnerId: adminFranchise.id,
    },
    create: {
      email: 'admin@giftfactory.local',
      passwordHash,
      role: Role.SUPERADMIN,
      franchiseId: adminFranchise.id,
      franchiseOwnerId: adminFranchise.id,
    },
  });

  const franchise = await prisma.franchise.upsert({
    where: { code: 'BLR-01' },
    update: {
      name: 'GiftFactory Bangalore Indiranagar',
      status: FranchiseStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
      kycVerifiedAt: new Date('2024-06-01'),
      basicDetailsCompleted: true,
      gstDetailsCompleted: true,
      businessName: 'GiftFactory BLR Indiranagar Pvt Ltd',
      ownerFullName: 'Arjun Mehta',
      ownerPhone: '919800000001',
      ownerEmail: 'owner@franchise.local',
      gstNumber: '29ABCDE1234F1Z5',
      panNumber: 'ABCDE1234F',
      sopChecklistCompleted: true,
      sopTrainingCompleted: true,
      sopBrandingCompleted: true,
      sopInfraAuditCompleted: true,
      sopPosSetupCompleted: true,
      sopSafetyCompleted: true,
      approvedAt: new Date('2024-06-15'),
      approvedByUserId: admin.id,
    },
    create: {
      name: 'GiftFactory Bangalore Indiranagar',
      code: 'BLR-01',
      status: FranchiseStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
      kycVerifiedAt: new Date('2024-06-01'),
      basicDetailsCompleted: true,
      gstDetailsCompleted: true,
      businessName: 'GiftFactory BLR Indiranagar Pvt Ltd',
      ownerFullName: 'Arjun Mehta',
      ownerPhone: '919800000001',
      ownerEmail: 'owner@franchise.local',
      gstNumber: '29ABCDE1234F1Z5',
      panNumber: 'ABCDE1234F',
      sopChecklistCompleted: true,
      sopTrainingCompleted: true,
      sopBrandingCompleted: true,
      sopInfraAuditCompleted: true,
      sopPosSetupCompleted: true,
      sopSafetyCompleted: true,
      approvedAt: new Date('2024-06-15'),
      approvedByUserId: admin.id,
      latitude: 12.9716,
      longitude: 77.5946,
      territory: 'Karnataka · Bangalore',
      state: 'Karnataka',
      addressLine1: '100 High Street',
      city: 'Bengaluru',
      postalCode: '560038',
      country: 'IN',
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@franchise.local' },
    update: { passwordHash, franchiseId: franchise.id },
    create: {
      email: 'owner@franchise.local',
      passwordHash,
      role: Role.FRANCHISE_OWNER,
      franchiseId: franchise.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff@franchise.local' },
    update: { passwordHash, franchiseId: franchise.id },
    create: {
      email: 'staff@franchise.local',
      passwordHash,
      role: Role.FRANCHISE_STAFF,
      franchiseId: franchise.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'auditor@franchise.local' },
    update: { passwordHash, franchiseId: franchise.id },
    create: {
      email: 'auditor@franchise.local',
      passwordHash,
      role: Role.FRANCHISE_AUDITOR,
      franchiseId: franchise.id,
    },
  });

  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: { passwordHash },
    create: {
      email: 'customer@example.com',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  const customer = await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: {
      userId: customerUser.id,
      name: 'Default Customer',
      phone: '919800000002',
    },
  });

  const defaultPermissionModules = [
    'orders',
    'products',
    'stock-requests',
    'roles',
    'permissions',
    'staff-management',
  ];

  // PermissionMatrix is scoped to a role in the current schema. We'll upsert
  // PermissionMatrix rows per-role with actions arrays instead of using a
  // legacy RolePermission model.

  const inventoryManagerRole = await prisma.appRole.upsert({
    where: {
      roleName_franchiseId: {
        roleName: 'Inventory Manager',
        franchiseId: franchise.id,
      },
    },
    update: {
      description: 'Manages products and stock requests for a franchise',
      isActive: true,
      isSystem: false,
      createdById: admin.id,
    },
    create: {
      roleName: 'Inventory Manager',
      description: 'Manages products and stock requests for a franchise',
      franchiseId: franchise.id,
      isActive: true,
      isSystem: false,
      createdById: admin.id,
    },
  });

  const franchiseOwnerRole = await prisma.appRole.upsert({
    where: {
      roleName_franchiseId: {
        roleName: 'Franchise Owner Default',
        franchiseId: franchise.id,
      },
    },
    update: {
      description: 'Default role for the seeded franchise owner',
      isActive: true,
      isSystem: false,
      createdById: admin.id,
    },
    create: {
      roleName: 'Franchise Owner Default',
      description: 'Default role for the seeded franchise owner',
      franchiseId: franchise.id,
      isActive: true,
      isSystem: false,
      createdById: admin.id,
    },
  });

  const franchiseAuditorRole = await prisma.appRole.upsert({
    where: {
      roleName_franchiseId: {
        roleName: 'Franchise Auditor Default',
        franchiseId: franchise.id,
      },
    },
    update: {
      description: 'Read-only role for franchise auditors',
      isActive: true,
      isSystem: false,
      createdById: admin.id,
    },
    create: {
      roleName: 'Franchise Auditor Default',
      description: 'Read-only role for franchise auditors',
      franchiseId: franchise.id,
      isActive: true,
      isSystem: false,
      createdById: admin.id,
    },
  });

  // Build permission actions for inventory manager and auditor roles
  const permissionActionsByModule: Record<
    string,
    Array<'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT'>
  > = {
    orders: ['READ', 'EXPORT'],
    products: ['READ', 'UPDATE'],
    'stock-requests': ['CREATE', 'READ', 'UPDATE'],
  };

  for (const moduleName of defaultPermissionModules) {
    const actionsForInventory = permissionActionsByModule[moduleName] ?? [];

    await prisma.permissionMatrix.upsert({
      where: {
        roleId_moduleName: { roleId: inventoryManagerRole.id, moduleName },
      },
      update: { actions: actionsForInventory },
      create: {
        roleId: inventoryManagerRole.id,
        moduleName,
        actions: actionsForInventory,
      },
    });

    // Auditor: only give read to orders
    if (moduleName === 'orders') {
      await prisma.permissionMatrix.upsert({
        where: {
          roleId_moduleName: { roleId: franchiseAuditorRole.id, moduleName },
        },
        update: { actions: ['READ'] },
        create: {
          roleId: franchiseAuditorRole.id,
          moduleName,
          actions: ['READ'],
        },
      });
    }
  }

  await prisma.user.update({
    where: { id: owner.id },
    data: {
      roleId: franchiseOwnerRole.id,
      franchiseOwnerId: franchise.id,
    },
  });

  await prisma.user.updateMany({
    where: {
      email: { in: ['staff@franchise.local'] },
    },
    data: {
      franchiseId: franchise.id,
      franchiseOwnerId: franchise.id,
      roleId: inventoryManagerRole.id,
    },
  });

  await prisma.user.update({
    where: { email: 'auditor@franchise.local' },
    data: {
      franchiseId: franchise.id,
      franchiseOwnerId: franchise.id,
      roleId: franchiseAuditorRole.id,
    },
  });

  await prisma.user.update({
    where: { id: owner.id },
    data: {
      franchiseId: franchise.id,
    },
  });

  async function cat(
    slug: string,
    name: string,
    parentId: string | null,
    sortOrder: number,
  ) {
    return prisma.category.upsert({
      where: { slug },
      update: { name, parentId, sortOrder },
      create: { slug, name, parentId, sortOrder },
    });
  }

  const rootGifts = await cat('gifts', 'Gifts', null, 1);
  const rootFlowers = await cat('flowers', 'Flowers & plants', null, 2);
  const rootHampers = await cat('hampers', 'Hampers & bundles', null, 3);

  const giftsRecipient = await cat(
    'gifts-by-recipient',
    'By recipient',
    rootGifts.id,
    1,
  );
  const giftsRecipientHer = await cat(
    'gifts-by-recipient-her',
    'For her',
    giftsRecipient.id,
    1,
  );
  const giftsRecipientHim = await cat(
    'gifts-by-recipient-him',
    'For him',
    giftsRecipient.id,
    2,
  );
  const giftsKids = await cat(
    'gifts-by-recipient-kids',
    'Kids & teens',
    giftsRecipient.id,
    3,
  );

  const giftsConfections = await cat(
    'gifts-confections',
    'Chocolates & sweets',
    rootGifts.id,
    2,
  );
  const giftsConfectionsPremium = await cat(
    'gifts-confections-premium',
    'Premium chocolate',
    giftsConfections.id,
    1,
  );
  const giftsConfectionsTruffles = await cat(
    'gifts-confections-truffles',
    'Truffles & pralines',
    giftsConfections.id,
    2,
  );

  const flowersOcc = await cat(
    'flowers-by-occasion',
    'By occasion',
    rootFlowers.id,
    1,
  );
  const flowersOccWedding = await cat(
    'flowers-by-occasion-wedding',
    'Wedding',
    flowersOcc.id,
    1,
  );
  await cat('flowers-by-occasion-birthday', 'Birthday', flowersOcc.id, 2);
  const flowersType = await cat(
    'flowers-by-type',
    'By type',
    rootFlowers.id,
    2,
  );
  const flowersTypeBouquets = await cat(
    'flowers-by-type-bouquets',
    'Bouquets',
    flowersType.id,
    1,
  );
  const flowersTypeRoses = await cat(
    'flowers-by-type-roses',
    'Roses',
    flowersType.id,
    2,
  );

  const hamperGourmet = await cat(
    'hampers-gourmet',
    'Gourmet food',
    rootHampers.id,
    1,
  );
  const hamperCorporate = await cat(
    'hampers-corporate',
    'Corporate gifting',
    rootHampers.id,
    2,
  );

  const gst = new Prisma.Decimal(18);

  type P = {
    slug: string;
    name: string;
    description: string;
    price: number;
    mrp: number;
    image: string;
    gallery?: string;
    categoryId: string;
    brand: string;
    occasions: string;
    ratingAvg: number;
    reviewCount: number;
    fastDelivery: boolean;
    isFeatured: boolean;
    warehouseQty: number;
    franchiseQty: number;
  };

  const products: P[] = [
    {
      slug: 'artisan-chocolate-box',
      name: 'Artisan Chocolate Box',
      description: 'Small-batch chocolates in a keepsake tin.',
      price: 1299,
      mrp: 1599,
      image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=800',
      gallery:
        'https://images.unsplash.com/photo-1526081347589-7de7f29e0f6c?w=800',
      categoryId: giftsConfectionsPremium.id,
      brand: 'Cocoa & Co.',
      occasions: 'Birthday,Anniversary,Thank you',
      ratingAvg: 4.7,
      reviewCount: 1280,
      fastDelivery: true,
      isFeatured: true,
      warehouseQty: 500,
      franchiseQty: 40,
    },
    {
      slug: 'sunrise-bouquet',
      name: 'Sunrise Bouquet',
      description: 'Seasonal blooms, hand-tied.',
      price: 899,
      mrp: 999,
      image:
        'https://images.unsplash.com/photo-1455659817273-f96807779a38?w=800',
      categoryId: flowersTypeBouquets.id,
      brand: 'BloomStreet',
      occasions: 'Birthday,Wedding,Congratulations',
      ratingAvg: 4.5,
      reviewCount: 890,
      fastDelivery: true,
      isFeatured: true,
      warehouseQty: 300,
      franchiseQty: 25,
    },
    {
      slug: 'velvet-truffle-assortment',
      name: 'Velvet Truffle Assortment',
      description: 'Dark and milk truffles in a velvet box.',
      price: 749,
      mrp: 899,
      image:
        'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800',
      categoryId: giftsConfectionsTruffles.id,
      brand: 'Cocoa & Co.',
      occasions: 'Corporate,Thank you',
      ratingAvg: 4.3,
      reviewCount: 210,
      fastDelivery: false,
      isFeatured: false,
      warehouseQty: 200,
      franchiseQty: 18,
    },
    {
      slug: 'luxury-rose-box-24',
      name: 'Luxury Rose Box · 24 stems',
      description: 'Long-stem roses in a rigid gift box.',
      price: 2499,
      mrp: 2999,
      image:
        'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=800',
      categoryId: flowersTypeRoses.id,
      brand: 'BloomStreet',
      occasions: 'Anniversary,Wedding,Valentine',
      ratingAvg: 4.9,
      reviewCount: 450,
      fastDelivery: true,
      isFeatured: true,
      warehouseQty: 120,
      franchiseQty: 10,
    },
    {
      slug: 'spa-relaxation-kit',
      name: 'Spa Relaxation Kit',
      description: 'Bath salts, candle, and silk eye mask.',
      price: 1599,
      mrp: 1999,
      image:
        'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800',
      categoryId: giftsRecipientHer.id,
      brand: 'Lumière Wellness',
      occasions: 'Birthday,Mother day,Thank you',
      ratingAvg: 4.6,
      reviewCount: 332,
      fastDelivery: false,
      isFeatured: false,
      warehouseQty: 80,
      franchiseQty: 12,
    },
    {
      slug: 'whiskey-glass-set',
      name: 'Crystal Whiskey Glass Set',
      description: 'Set of 2 lead-free crystal tumblers.',
      price: 1899,
      mrp: 2299,
      image:
        'https://images.unsplash.com/photo-1514362545857-ed01f7e668f5?w=800',
      categoryId: giftsRecipientHim.id,
      brand: 'Northline Home',
      occasions: 'Birthday,Father day,Corporate',
      ratingAvg: 4.4,
      reviewCount: 156,
      fastDelivery: true,
      isFeatured: false,
      warehouseQty: 95,
      franchiseQty: 8,
    },
    {
      slug: 'kids-diy-cookie-kit',
      name: 'Kids DIY Cookie Kit',
      description: 'Pre-measured ingredients and cutters.',
      price: 499,
      mrp: 649,
      image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800',
      categoryId: giftsKids.id,
      brand: 'TinyChef',
      occasions: 'Birthday,Kids',
      ratingAvg: 4.2,
      reviewCount: 78,
      fastDelivery: true,
      isFeatured: false,
      warehouseQty: 400,
      franchiseQty: 30,
    },
    {
      slug: 'gourmet-snack-hamper',
      name: 'Gourmet Snack Hamper',
      description: 'Savory snacks, crackers, and preserves.',
      price: 2199,
      mrp: 2599,
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
      categoryId: hamperGourmet.id,
      brand: 'Pantry & Co.',
      occasions: 'Corporate,Diwali,Thank you',
      ratingAvg: 4.5,
      reviewCount: 540,
      fastDelivery: false,
      isFeatured: true,
      warehouseQty: 60,
      franchiseQty: 6,
    },
    {
      slug: 'corporate-logo-gift-set',
      name: 'Corporate Logo Gift Set',
      description: 'Notebook, pen, and card — logo engraving optional.',
      price: 999,
      mrp: 1299,
      image:
        'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800',
      categoryId: hamperCorporate.id,
      brand: 'DeskWorks',
      occasions: 'Corporate',
      ratingAvg: 4.1,
      reviewCount: 92,
      fastDelivery: false,
      isFeatured: false,
      warehouseQty: 150,
      franchiseQty: 20,
    },
    {
      slug: 'wedding-garland-package',
      name: 'Wedding Garland Package',
      description: 'Fresh jasmine and marigold strands.',
      price: 3299,
      mrp: 3799,
      image:
        'https://images.unsplash.com/photo-1464366400600-7168ecd8ca5a?w=800',
      categoryId: flowersOccWedding.id,
      brand: 'BloomStreet',
      occasions: 'Wedding',
      ratingAvg: 4.8,
      reviewCount: 67,
      fastDelivery: true,
      isFeatured: true,
      warehouseQty: 40,
      franchiseQty: 4,
    },
  ];

  // Insert a minimal dummy product compatible with current schema and stop
  // (keeps existing seed flows intact and avoids the legacy bulk insertion).
  const dummyProduct = await prisma.product.upsert({
    where: { slug: 'seed-dummy-product' },
    update: {
      name: 'Seed Dummy Product',
      description: 'A single dummy product inserted by seed for local tests',
      price: new Prisma.Decimal(199.0),
      mrpPrice: new Prisma.Decimal(249.0),
      basePrice: new Prisma.Decimal(139.0),
      wholesalePrice: new Prisma.Decimal(169.0),
      categoryId: giftsConfectionsPremium.id,
      visibility: true,
      fastDelivery: true,
      isFeatured: false,
      defaultGstRatePercent: new Prisma.Decimal(18),
      imageUrl: getBackupImage(0),
      imageUrls: [getBackupImage(0)],
    },
    create: {
      slug: 'seed-dummy-product',
      name: 'Seed Dummy Product',
      description: 'A single dummy product inserted by seed for local tests',
      price: new Prisma.Decimal(199.0),
      mrpPrice: new Prisma.Decimal(249.0),
      basePrice: new Prisma.Decimal(139.0),
      wholesalePrice: new Prisma.Decimal(169.0),
      categoryId: giftsConfectionsPremium.id,
      visibility: true,
      fastDelivery: true,
      isFeatured: false,
      defaultGstRatePercent: new Prisma.Decimal(18),
      imageUrl: getBackupImage(0),
      imageUrls: [getBackupImage(0)],
    },
  });

  console.log('Seed: created dummy product', dummyProduct.slug);

  // Create a seed Brand and multiple (12) products compatible with current schema.
  const seedBrand = await prisma.brand.upsert({
    where: { slug: 'seed-brand' },
    update: { name: 'Seed Brand' },
    create: {
      name: 'Seed Brand',
      slug: 'seed-brand',
      description: 'Auto-generated seed brand',
    },
  });

  const categoryCandidates = [
    giftsConfectionsPremium.id,
    flowersTypeBouquets.id,
    giftsRecipientHer.id,
    giftsRecipientHim.id,
    hamperGourmet.id,
    hamperCorporate.id,
    flowersTypeRoses.id,
  ];

  const createdSeedSlugs: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const slug = `seed-product-${i}`;
    const name = `Seed Product ${i}`;
    const catId = categoryCandidates[i % categoryCandidates.length];
    const priceNum = 500 + Math.floor(Math.random() * 2500);
    const mrpNum = priceNum + 100 + Math.floor(Math.random() * 400);
    const priceDec = new Prisma.Decimal(priceNum);
    const mrpDec = new Prisma.Decimal(mrpNum);
    const baseDec = new Prisma.Decimal(priceNum * 0.7);
    const wholesaleDec = new Prisma.Decimal(priceNum * 0.85);

    const prod = await prisma.product.upsert({
      where: { slug },
      update: {
        name,
        description: `Auto-generated seed product ${i}`,
        price: priceDec,
        mrpPrice: mrpDec,
        basePrice: baseDec,
        wholesalePrice: wholesaleDec,
        categoryId: catId,
        visibility: true,
        fastDelivery: Math.random() > 0.5,
        isFeatured: false,
        defaultGstRatePercent: new Prisma.Decimal(18),
        imageUrl: getBackupImage(i),
        imageUrls: [getBackupImage(i)],
        brandId: seedBrand.id,
      },
      create: {
        slug,
        name,
        description: `Auto-generated seed product ${i}`,
        price: priceDec,
        mrpPrice: mrpDec,
        basePrice: baseDec,
        wholesalePrice: wholesaleDec,
        categoryId: catId,
        visibility: true,
        fastDelivery: Math.random() > 0.5,
        isFeatured: false,
        defaultGstRatePercent: new Prisma.Decimal(18),
        imageUrl: getBackupImage(i),
        imageUrls: [getBackupImage(i)],
        brandId: seedBrand.id,
      },
    });

    // Ensure warehouse and franchise stock entries exist for the product
    await prisma.warehouseStock.upsert({
      where: { productId: prod.id },
      update: { quantity: 100 },
      create: { productId: prod.id, quantity: 100 },
    });

    await prisma.franchiseStock.upsert({
      where: {
        franchiseId_productId: {
          franchiseId: franchise.id,
          productId: prod.id,
        },
      },
      update: { quantity: 10 },
      create: { franchiseId: franchise.id, productId: prod.id, quantity: 10 },
    });

    createdSeedSlugs.push(slug);
  }

  console.log('Seed: created brand and', createdSeedSlugs.length, 'products');

  const createdProducts: {
    id: string;
    slug: string;
    price: Prisma.Decimal;
    defaultGst: Prisma.Decimal;
  }[] = [];
  for (const p of products) {
    const imageUrls: string[] = (
      p.gallery ? [p.image, p.gallery] : [p.image]
    ) as string[];

    let brandId: string | undefined = undefined;
    if (p.brand) {
      const bSlug = p.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const brandObj = await prisma.brand.upsert({
        where: { slug: bSlug },
        update: { name: p.brand },
        create: { slug: bSlug, name: p.brand },
      });
      brandId = brandObj.id;
    }

    const baseDec = new Prisma.Decimal(p.price * 0.7);
    const wholesaleDec = new Prisma.Decimal(p.price * 0.85);

    const row = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        mrpPrice: p.mrp,
        basePrice: baseDec,
        wholesalePrice: wholesaleDec,
        imageUrl: p.image,
        imageUrls,
        defaultGstRatePercent: gst,
        categoryId: p.categoryId,
        brandId,
        occasions: p.occasions,
        ratingAvg: p.ratingAvg,
        reviewCount: p.reviewCount,
        fastDelivery: p.fastDelivery,
        isFeatured: p.isFeatured,
        visibility: true,
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        price: p.price,
        mrpPrice: p.mrp,
        basePrice: baseDec,
        wholesalePrice: wholesaleDec,
        imageUrl: p.image,
        imageUrls,
        defaultGstRatePercent: gst,
        categoryId: p.categoryId,
        brandId,
        occasions: p.occasions,
        ratingAvg: p.ratingAvg,
        reviewCount: p.reviewCount,
        fastDelivery: p.fastDelivery,
        isFeatured: p.isFeatured,
        visibility: true,
      },
    });
    createdProducts.push({
      id: row.id,
      slug: row.slug,
      price: row.price,
      defaultGst: row.defaultGstRatePercent,
    });
    await prisma.warehouseStock.upsert({
      where: { productId: row.id },
      update: { quantity: p.warehouseQty },
      create: { productId: row.id, quantity: p.warehouseQty },
    });
    await prisma.franchiseStock.upsert({
      where: {
        franchiseId_productId: { franchiseId: franchise.id, productId: row.id },
      },
      update: { quantity: p.franchiseQty },
      create: {
        franchiseId: franchise.id,
        productId: row.id,
        quantity: p.franchiseQty,
      },
    });
  }

  // Seed Products and Variants from Backups
  try {
    const productsPath = path.join(process.cwd(), 'backups', 'mvs.products.json');
    const variantsPath = path.join(process.cwd(), 'backups', 'mvs.productvariants.json');

    if (fs.existsSync(productsPath)) {
      console.log('Found backups/mvs.products.json. Seeding products...');
      const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      let productCount = 0;
      const processedSlugs = new Set<string>();

      // Seeding first 50 products is extremely fast and sufficient
      const processedCategories = new Set<string>();
      const processedBrands = new Set<string>();

      for (const p of productsData) {
        if (!p._id || !p._id.$oid) continue;
        const pId = p._id.$oid;

        // Ensure unique slug
        let slug = p.slug || `slug-${pId}`;
        if (processedSlugs.has(slug)) {
          slug = `${slug}-${pId}`;
        }
        processedSlugs.add(slug);

        // Upsert Category
        const catId = p.categoryId?.$oid || 'default-cat';
        if (!processedCategories.has(catId)) {
          await prisma.category.upsert({
            where: { id: catId },
            update: {},
            create: {
              id: catId,
              name: p.categoryName || `Category ${catId}`,
              slug: `cat-${catId}`,
            },
          });
          processedCategories.add(catId);
        }

        // Upsert Brand
        let brandId: string | undefined = undefined;
        if (p.brandId?.$oid) {
          const bId = p.brandId.$oid;
          brandId = bId;
          if (!processedBrands.has(bId)) {
            await prisma.brand.upsert({
              where: { id: bId },
              update: {},
              create: {
                id: bId,
                name: `Brand ${bId}`,
                slug: `brand-${bId}`,
              },
            });
            processedBrands.add(bId);
          }
        }

        // Parse price and mrp safely
        let priceVal = 0;
        let mrpVal = 0;
        let basePriceVal = 0;
        let wholesalePriceVal = 0;
        let defaultGst = 18;

        if (typeof p.price === 'number') {
          priceVal = p.price;
          mrpVal = priceVal;
          basePriceVal = priceVal * 0.7;
        } else if (p.price && typeof p.price === 'object') {
          priceVal = p.price.sellingPrice || p.price.productSellingPrice || 0;
          mrpVal = p.price.mrp || priceVal || 0;
          basePriceVal = p.price.productSellingPrice || priceVal * 0.7;
          if (p.price.gstRate) {
            defaultGst = p.price.gstRate < 1 ? p.price.gstRate * 100 : p.price.gstRate;
          }
        }
        if (p.defaultPrice && !priceVal) {
          priceVal = p.defaultPrice;
          mrpVal = priceVal;
          basePriceVal = priceVal * 0.7;
        }

        if (p.b2bPriceTiers && Array.isArray(p.b2bPriceTiers) && p.b2bPriceTiers.length > 0) {
          const firstTier = p.b2bPriceTiers[0];
          if (firstTier && typeof firstTier.price === 'number') {
            wholesalePriceVal = firstTier.price;
          }
        } else if (p.moq && typeof p.moq === 'object' && typeof p.moq.price === 'number') {
          wholesalePriceVal = p.moq.price;
        }

        if (!wholesalePriceVal) {
          wholesalePriceVal = (basePriceVal + priceVal) / 2;
        }

        // Logical safety hierarchies
        if (mrpVal < priceVal) mrpVal = priceVal;
        if (wholesalePriceVal < basePriceVal) wholesalePriceVal = basePriceVal;
        if (wholesalePriceVal > priceVal) wholesalePriceVal = priceVal;

        const imageUrl = p.baseImageUrl?.[0] || getBackupImage(productCount);
        const imageUrls = p.baseImageUrl || [imageUrl];

        await prisma.product.upsert({
          where: { id: pId },
          update: {
            name: p.title || `Product ${pId}`,
            slug,
            description: p.description || p.sub_title || '',
            stock: clampInt(p.stock, 0),
            gstTax: clampInt(defaultGst, 18),
            price: new Prisma.Decimal(priceVal),
            mrpPrice: new Prisma.Decimal(mrpVal),
            basePrice: new Prisma.Decimal(basePriceVal),
            wholesalePrice: new Prisma.Decimal(wholesalePriceVal),
            categoryId: catId,
            brandId: brandId,
            visibility: p.visibility === 'public',
            status: p.status === 'approved' ? 'ACTIVE' : 'ACTIVE', // Map to ProductStatus enum
            imageUrl,
            imageUrls,
            explicitAttributes: p.explicitAttributes || {},
            features: p.features || [],
          },
          create: {
            id: pId,
            name: p.title || `Product ${pId}`,
            slug,
            description: p.description || p.sub_title || '',
            stock: clampInt(p.stock, 0),
            gstTax: clampInt(defaultGst, 18),
            price: new Prisma.Decimal(priceVal),
            mrpPrice: new Prisma.Decimal(mrpVal),
            basePrice: new Prisma.Decimal(basePriceVal),
            wholesalePrice: new Prisma.Decimal(wholesalePriceVal),
            categoryId: catId,
            brandId: brandId,
            visibility: p.visibility === 'public',
            status: p.status === 'approved' ? 'ACTIVE' : 'ACTIVE',
            imageUrl,
            imageUrls,
            explicitAttributes: p.explicitAttributes || {},
            features: p.features || [],
          },
        });
        productCount++;
      }
      console.log(`Seeded ${productCount} products from backups.`);
    }

    if (fs.existsSync(variantsPath)) {
      console.log('Found backups/mvs.productvariants.json. Seeding variants...');
      const variantsData = JSON.parse(fs.readFileSync(variantsPath, 'utf8'));
      let variantCount = 0;
      const processedSkus = new Set<string>();

      const existingProductIds = new Set(
        (await prisma.product.findMany({ select: { id: true } })).map((p) => p.id)
      );

      for (const v of variantsData) {
        if (!v._id || !v._id.$oid || !v.productId || !v.productId.$oid) continue;
        const vId = v._id.$oid;
        const pId = v.productId.$oid;

        // Verify product exists in database before seeding variant
        if (!existingProductIds.has(pId)) continue;

        // Ensure unique SKU
        let sku = v.sku || `sku-${vId}`;
        if (processedSkus.has(sku)) {
          sku = `${sku}-${vId}`;
        }
        processedSkus.add(sku);

        let vPrice = 0;
        let vMrp = 0;
        let vBasePrice = 0;
        let vWholesalePrice = 0;
        let vGst = 18;

        if (typeof v.price === 'number') {
          vPrice = v.price;
          vMrp = vPrice;
          vBasePrice = vPrice * 0.7;
        } else if (v.price && typeof v.price === 'object') {
          vPrice = v.price.sellingPrice || v.price.productSellingPrice || 0;
          vMrp = v.price.mrp || vPrice || 0;
          vBasePrice = v.price.productSellingPrice || vPrice * 0.7;
          if (v.price.gstRate) {
            vGst = v.price.gstRate < 1 ? v.price.gstRate * 100 : v.price.gstRate;
          }
        }

        if (v.b2bPriceTiers && Array.isArray(v.b2bPriceTiers) && v.b2bPriceTiers.length > 0) {
          const firstTier = v.b2bPriceTiers[0];
          if (firstTier && typeof firstTier.price === 'number') {
            vWholesalePrice = firstTier.price;
          }
        } else if (v.moq && typeof v.moq === 'object' && typeof v.moq.price === 'number') {
          vWholesalePrice = v.moq.price;
        }

        if (!vWholesalePrice) {
          vWholesalePrice = (vBasePrice + vPrice) / 2;
        }

        // Logical safety hierarchies
        if (vMrp < vPrice) vMrp = vPrice;
        if (vWholesalePrice < vBasePrice) vWholesalePrice = vBasePrice;
        if (vWholesalePrice > vPrice) vWholesalePrice = vPrice;

        const attributeSummary = v.explicitAttributes?.map((a: any) => `${a.label}:${a.value}`).join('|') || `Option:${v.title || vId}`;
        const searchText = `${v.title || ''} ${sku}`.toLowerCase();

        await prisma.productVariant.upsert({
          where: { id: vId },
          update: {
            productId: pId,
            sku,
            price: new Prisma.Decimal(vPrice),
            mrpPrice: new Prisma.Decimal(vMrp),
            basePrice: new Prisma.Decimal(vBasePrice),
            wholesalePrice: new Prisma.Decimal(vWholesalePrice),
            stock: clampInt(v.stock, 0),
            gstTax: clampInt(vGst, 18),
            imageUrl: v.images?.[0] || getBackupImage(variantCount),
            imageUrls: v.images && v.images.length > 0 ? v.images : [getBackupImage(variantCount)],
            attributeSummary,
            searchText,
            isActive: !v.isDeleted,
          },
          create: {
            id: vId,
            productId: pId,
            sku,
            price: new Prisma.Decimal(vPrice),
            mrpPrice: new Prisma.Decimal(vMrp),
            basePrice: new Prisma.Decimal(vBasePrice),
            wholesalePrice: new Prisma.Decimal(vWholesalePrice),
            stock: clampInt(v.stock, 0),
            gstTax: clampInt(vGst, 18),
            imageUrl: v.images?.[0] || getBackupImage(variantCount),
            imageUrls: v.images && v.images.length > 0 ? v.images : [getBackupImage(variantCount)],
            attributeSummary,
            searchText,
            isActive: !v.isDeleted,
          },
        });
        variantCount++;
      }
      console.log(`Seeded ${variantCount} product variants from backups.`);
    }

    const mediaPath = path.join(process.cwd(), 'backups', 'mvs.medialibraries.json');
    if (fs.existsSync(mediaPath)) {
      console.log('Found backups/mvs.medialibraries.json. Seeding media library...');
      const mediaData = JSON.parse(fs.readFileSync(mediaPath, 'utf8'));
      let mediaCount = 0;
      for (const m of mediaData) {
        if (!m._id || !m._id.$oid || !m.url) continue;
        const mId = m._id.$oid;
        await prisma.mediaLibrary.upsert({
          where: { id: mId },
          update: {
            url: m.url,
            key: m.url,
            mimeType: m.mimeType || 'image/png',
            size: String(m.size || '0'),
            createdAt: m.createdAt?.$date ? new Date(m.createdAt.$date) : new Date(),
            updatedAt: m.updatedAt?.$date ? new Date(m.updatedAt.$date) : new Date(),
          },
          create: {
            id: mId,
            url: m.url,
            key: m.url,
            mimeType: m.mimeType || 'image/png',
            size: String(m.size || '0'),
            createdAt: m.createdAt?.$date ? new Date(m.createdAt.$date) : new Date(),
            updatedAt: m.updatedAt?.$date ? new Date(m.updatedAt.$date) : new Date(),
          },
        });
        mediaCount++;
      }
      console.log(`Seeded ${mediaCount} media library items from backups.`);
    }
  } catch (err: any) {
    console.error('Error seeding backup data:', err.message || err);
  }

  const pBouquet = createdProducts.find((x) => x.slug === 'sunrise-bouquet')!;
  const pChocolate = createdProducts.find(
    (x) => x.slug === 'artisan-chocolate-box',
  )!;

  const centralNode = await prisma.stockingNode.upsert({
    where: { code: 'CENTRAL' },
    update: { active: true },
    create: {
      type: StockingNodeType.CENTRAL_DC,
      name: 'National DC',
      code: 'CENTRAL',
      sortOrder: 0,
    },
  });
  const storeNode = await prisma.stockingNode.upsert({
    where: { code: `STORE-${franchise.code}` },
    update: {
      franchiseId: franchise.id,
      parentId: centralNode.id,
      name: franchise.name,
    },
    create: {
      type: StockingNodeType.STORE,
      name: franchise.name,
      code: `STORE-${franchise.code}`,
      franchiseId: franchise.id,
      parentId: centralNode.id,
      sortOrder: 10,
    },
  });
  const seedLane = await prisma.transportLane.upsert({
    where: { code: 'LANE-CENTRAL-BLR01' },
    update: {
      originNodeId: centralNode.id,
      destNodeId: storeNode.id,
      active: true,
    },
    create: {
      code: 'LANE-CENTRAL-BLR01',
      name: 'DC to BLR-01',
      originNodeId: centralNode.id,
      destNodeId: storeNode.id,
      defaultSlaHours: 72,
      allocationPriority: 10,
    },
  });
  await prisma.replenishmentPolicy.upsert({
    where: {
      franchiseId_productId: {
        franchiseId: franchise.id,
        productId: pChocolate.id,
      },
    },
    update: { minQty: 5, maxQty: 80, reorderPoint: 15, active: true },
    create: {
      franchiseId: franchise.id,
      productId: pChocolate.id,
      minQty: 5,
      maxQty: 80,
      reorderPoint: 15,
      active: true,
    },
  });

  const shipQty = 4;
  const unit = new Prisma.Decimal(pChocolate.price);
  const sub = unit.mul(shipQty);
  const tax = sub.mul(gst).div(new Prisma.Decimal(100));
  const billTotal = sub.add(tax);

  await prisma.stockRequest.upsert({
    where: { id: 'seed-sr-pending' },
    update: {},
    create: {
      id: 'seed-sr-pending',
      franchiseId: franchise.id,
      productId: pBouquet.id,
      quantity: 10,
      status: StockRequestStatus.PENDING,
      note: 'Seeded pending restock (E2E)',
    },
  });

  const approvedAt = new Date('2025-01-10T10:00:00Z');
  const paidAt = new Date('2025-01-10T12:00:00Z');
  const dispatchedAt = new Date('2025-01-10T14:00:00Z');

  await prisma.stockRequest.upsert({
    where: { id: 'seed-sr-in-transit' },
    update: {
      productId: pChocolate.id,
      status: StockRequestStatus.APPROVED,
      paymentStatus: StockRequestPaymentStatus.PAID,
    },
    create: {
      id: 'seed-sr-in-transit',
      franchiseId: franchise.id,
      productId: pChocolate.id,
      quantity: shipQty,
      approvedQuantity: shipQty,
      status: StockRequestStatus.APPROVED,
      note: 'Seeded approved + paid; delivery in transit',
      reviewedById: admin.id,
      reviewedAt: approvedAt,
      unitPriceAtApproval: unit,
      gstRatePercent: gst,
      billingSubtotal: sub,
      billingTax: tax,
      billingTotal: billTotal,
      paymentStatus: StockRequestPaymentStatus.PAID,
      paymentReference: 'SEED-UTR-773311',
      paymentNote: 'Test payment (seed)',
      paymentReceivedAt: paidAt,
    },
  });

  await prisma.inboundDelivery.upsert({
    where: { id: 'seed-delivery-1' },
    update: {
      transportLaneId: seedLane.id,
      carrierReference: 'SEED-AWB-001',
      slaDueAt: new Date(dispatchedAt.getTime() + 72 * 3600 * 1000),
      quantityShipped: shipQty,
    },
    create: {
      id: 'seed-delivery-1',
      franchiseId: franchise.id,
      stockRequestId: 'seed-sr-in-transit',
      transportLaneId: seedLane.id,
      status: DeliveryStatus.IN_TRANSIT,
      carrier: 'Central warehouse',
      trackingCode: 'WH-SEED01',
      carrierReference: 'SEED-AWB-001',
      slaDueAt: new Date(dispatchedAt.getTime() + 72 * 3600 * 1000),
      quantityShipped: shipQty,
      dispatchedAt,
      stockApplied: false,
    },
  });

  await prisma.promotion.upsert({
    where: { slug: 'seed-festive-10' },
    update: { applyToAll: true },
    create: {
      name: 'Seed festive 10% off',
      slug: 'seed-festive-10',
      description: 'Test promotion from seed data',
      percentOff: new Prisma.Decimal(10),
      active: true,
      applyToAll: true,
    },
  });

  const pSunrise = pBouquet;
  const lineQty = 1;
  const lineTotal = pSunrise.price.mul(lineQty);

  const orderOnline = await prisma.order.upsert({
    where: { orderNumber: 'SEED-GF-ONLINE-001' },
    update: {},
    create: {
      orderNumber: 'SEED-GF-ONLINE-001',
      channel: OrderChannel.ONLINE,
      status: OrderStatus.CONFIRMED,
      franchiseId: franchise.id,
      customerId: customer.id,
      total: lineTotal,
      latitude: 12.9352,
      longitude: 77.6245,
      addressJson: JSON.stringify({
        line1: '21 Residency Road',
        city: 'Bengaluru',
        state: 'KA',
        pin: '560025',
      }),
      giftMessage: 'Happy birthday — from seed data',
      paymentMode: PaymentModeEnum.ONLINE,
      onlinePaymentStatus: OnlinePaymentStatus.PAID,
      paidAt: new Date('2024-07-01'),
      paymentProvider: 'demo',
      paymentReference: 'seed-paid',
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: orderOnline.id } });
  await prisma.orderItem.create({
    data: {
      orderId: orderOnline.id,
      productId: pSunrise.id,
      quantity: lineQty,
      unitPrice: pSunrise.price,
    },
  });
  await prisma.franchiseStock.update({
    where: {
      franchiseId_productId: {
        franchiseId: franchise.id,
        productId: pSunrise.id,
      },
    },
    data: { quantity: { decrement: lineQty } },
  });

  const posLine = createdProducts.find(
    (x) => x.slug === 'kids-diy-cookie-kit',
  )!;
  const posQty = 1;
  const posTotal = posLine.price.mul(posQty);
  const orderPos = await prisma.order.upsert({
    where: { orderNumber: 'SEED-GF-POS-001' },
    update: {},
    create: {
      orderNumber: 'SEED-GF-POS-001',
      channel: OrderChannel.POS,
      status: OrderStatus.COMPLETED,
      franchiseId: franchise.id,
      total: posTotal,
      latitude: franchise.latitude,
      longitude: franchise.longitude,
      addressJson: JSON.stringify({ store: 'Counter', city: franchise.city }),
      paymentMode: PaymentModeEnum.UPI,
      soldByUserId: owner.id,
      invoiceNumber: 'SEED-INV-0001',
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: orderPos.id } });
  await prisma.orderItem.create({
    data: {
      orderId: orderPos.id,
      productId: posLine.id,
      quantity: posQty,
      unitPrice: posLine.price,
    },
  });
  await prisma.franchiseStock.update({
    where: {
      franchiseId_productId: {
        franchiseId: franchise.id,
        productId: posLine.id,
      },
    },
    data: { quantity: { decrement: posQty } },
  });

  await prisma.franchiseReturn.deleteMany({ where: { id: 'seed-return-1' } });
  await prisma.franchiseReturn.create({
    data: {
      id: 'seed-return-1',
      franchiseId: franchise.id,
      orderId: orderOnline.id,
      reason: 'Outer box slightly damaged (seed return)',
      status: FranchiseReturnStatus.PENDING,
      refundRequested: true,
    },
  });

  await prisma.franchiseNotice.upsert({
    where: { id: 'seed-notice-1' },
    update: {},
    create: {
      id: 'seed-notice-1',
      title: 'Holiday dispatch schedule',
      body: 'This is broadcast seed data. All franchises: last-mile slots may run 1–2h later from Dec 20–Jan 5.',
      audience: NoticeAudience.ALL_FRANCHISES,
      createdByUserId: admin.id,
    },
  });

  await prisma.franchiseNotice.upsert({
    where: { id: 'seed-notice-2' },
    update: {},
    create: {
      id: 'seed-notice-2',
      title: 'BLR-01: POS training reminder',
      body: 'Seeded direct notice. Please complete the POS quick-ref quiz when you can — test data only.',
      audience: NoticeAudience.SINGLE_FRANCHISE,
      franchiseId: franchise.id,
      createdByUserId: admin.id,
    },
  });

  const seedTicket = await prisma.supportTicket.upsert({
    where: { id: 'seed-ticket-1' },
    update: {},
    create: {
      id: 'seed-ticket-1',
      franchiseId: franchise.id,
      type: SupportTicketType.BILLING,
      subject: 'Clarify GST on last stock order (seed)',
      status: SupportTicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      createdByUserId: owner.id,
    },
  });

  await prisma.ticketMessage.deleteMany({ where: { ticketId: seedTicket.id } });
  await prisma.ticketMessage.createMany({
    data: [
      {
        ticketId: seedTicket.id,
        authorUserId: owner.id,
        body: 'Seeded message: can you confirm 18% on last invoice?',
      },
      {
        ticketId: seedTicket.id,
        authorUserId: admin.id,
        body: 'Seeded HQ reply: will verify on next sync — this is test data.',
      },
    ],
  });

  await prisma.franchiseDocument.upsert({
    where: { id: 'seed-doc-1' },
    update: {},
    create: {
      id: 'seed-doc-1',
      franchiseId: franchise.id,
      kind: FranchiseDocumentKind.GST,
      title: 'GST registration certificate (sample)',
      fileUrl:
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      uploadedByUserId: owner.id,
      verifiedAt: new Date('2025-02-01'),
      verifiedByUserId: admin.id,
    },
  });

  await prisma.webhookEndpoint.deleteMany({
    where: { label: 'Seed E2E listener' },
  });
  const webhook = await prisma.webhookEndpoint.create({
    data: {
      label: 'Seed E2E listener',
      url: 'https://httpbin.org/post',
      secret: 'seed-hmac-secret-only-for-dev',
      events: 'stock_request.approved,stock_request.rejected',
      active: true,
    },
  });

  console.log('Seed complete:', {
    logins: {
      superadmin: 'admin@giftfactory.local / Password123!',
      franchiseOwner: 'owner@franchise.local / Password123!',
      franchiseStaff: 'staff@franchise.local / Password123!',
      auditor: 'auditor@franchise.local / Password123!',
      customer: 'customer@example.com / Password123!',
    },
    franchise: franchise.code,
    categories: '3 trees with depth',
    products: createdProducts.length,
    stockRequests: 'seed-sr-pending, seed-sr-in-transit + delivery',
    orders: [orderOnline.orderNumber, orderPos.orderNumber],
    webhooks: webhook.id,
  });

  // Call dynamic minimum records checker at the end of seeding
  await ensureAllEntitiesHaveMinimumRecords();
}

async function ensureAllEntitiesHaveMinimumRecords() {
  console.log('--- Starting dynamic seeding of all entities to ensure at least 5 records ---');
  const models = (Prisma as any).dmmf?.datamodel?.models || [];
  const visited = new Set<string>();
  const seeding = new Set<string>();

  async function ensureModelHasRecords(modelName: string) {
    if (visited.has(modelName)) return;
    if (seeding.has(modelName)) {
      // Break direct cycles
      return;
    }
    seeding.add(modelName);

    const nameLower = modelName.toLowerCase();
    // Exclude return-related models
    if (nameLower.includes('return') || nameLower.includes('movement')) {
      seeding.delete(modelName);
      visited.add(modelName);
      return;
    }

    const model = models.find((m: any) => m.name === modelName);
    if (!model) {
      seeding.delete(modelName);
      visited.add(modelName);
      return;
    }

    // 1. Resolve required parent relations first
    const requiredRelations = model.fields.filter((f: any) =>
      f.kind === 'object' &&
      !f.isList &&
      (f.isRequired || f.relationFromFields?.some((fk: string) => {
        const fkField = model.fields.find((field: any) => field.name === fk);
        return fkField?.isRequired;
      }))
    );

    for (const rel of requiredRelations) {
      await ensureModelHasRecords(rel.type);
    }

    // 2. Ensure at least 5 records exist
    const clientName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const delegate = (prisma as any)[clientName];
    if (!delegate) {
      seeding.delete(modelName);
      visited.add(modelName);
      return;
    }

    const currentCount = await delegate.count();
    if (currentCount < 5) {
      const needed = 5 - currentCount;
      console.log(`Model ${modelName}: current count is ${currentCount}. Seeding ${needed} more...`);

      // Fetch pools of available parent records
      const relationPools: Record<string, any[]> = {};
      for (const rel of requiredRelations) {
        const relClientName = rel.type.charAt(0).toLowerCase() + rel.type.slice(1);
        const relDelegate = (prisma as any)[relClientName];
        if (relDelegate) {
          relationPools[rel.name] = await relDelegate.findMany({ take: 20 });
        }
      }

      for (let i = 0; i < needed; i++) {
        const data: any = {};
        const foreignKeyScalars = new Set(requiredRelations.flatMap((r: any) => r.relationFromFields || []));

        // A. Generate required scalars (non-list)
        const scalarFields = model.fields.filter((f: any) =>
          f.kind === 'scalar' &&
          f.isRequired &&
          !f.isList &&
          !f.isId &&
          !f.hasDefaultValue &&
          !foreignKeyScalars.has(f.name)
        );

        for (const field of scalarFields) {
          data[field.name] = generateDummyScalarValue(modelName, field, i + currentCount);
        }

        // A2. Generate required list fields (e.g. String[] or Json[])
        const listFields = model.fields.filter((f: any) =>
          f.kind === 'scalar' &&
          f.isRequired &&
          f.isList &&
          !f.hasDefaultValue &&
          !foreignKeyScalars.has(f.name)
        );

        for (const field of listFields) {
          if (field.type === 'Json') {
            data[field.name] = [{}];
          } else {
            data[field.name] = [generateDummyScalarValue(modelName, { ...field, isList: false }, i + currentCount)];
          }
        }

        // B. Generate required enums
        const enumFields = model.fields.filter((f: any) =>
          f.kind === 'enum' &&
          f.isRequired &&
          !f.isList
        );
        for (const field of enumFields) {
          const enumDef = (Prisma as any).dmmf?.datamodel?.enums?.find((e: any) => e.name === field.type);
          if (enumDef && enumDef.values?.length > 0) {
            data[field.name] = enumDef.values[0].name;
          }
        }

        // B2. Generate required enum list fields (if any)
        const enumListFields = model.fields.filter((f: any) =>
          f.kind === 'enum' &&
          f.isRequired &&
          f.isList
        );
        for (const field of enumListFields) {
          const enumDef = (Prisma as any).dmmf?.datamodel?.enums?.find((e: any) => e.name === field.type);
          if (enumDef && enumDef.values?.length > 0) {
            data[field.name] = [enumDef.values[0].name];
          }
        }

        // C. Connect required relations (avoiding same-parent duplicate violations dynamically)
        let relIndex = 0;
        for (const rel of requiredRelations) {
          const pool = relationPools[rel.name] || [];
          if (pool.length > 0) {
            const chosen = pool[(i + relIndex) % pool.length];
            relIndex++;
            const toFields = rel.relationToFields || ['id'];
            if (toFields.length > 0) {
              data[rel.name] = {
                connect: {
                  [toFields[0]]: chosen[toFields[0]]
                }
              };
            }
          } else {
            console.warn(`[WARNING] No records available for required relation ${rel.name} of ${modelName}`);
          }
        }

        try {
          await delegate.create({ data });
        } catch (err: any) {
          console.error(`[ERROR] Failed to seed record ${i} for ${modelName}:`, err.message || err);
        }
      }
    }

    seeding.delete(modelName);
    visited.add(modelName);
  }

  for (const m of models) {
    await ensureModelHasRecords(m.name);
  }
  console.log('--- Finished dynamic seeding check ---');
}

function generateDummyScalarValue(modelName: string, field: any, index: number): any {
  const uniqueVal = `${modelName}-${field.name}-${index}-${Math.floor(Math.random() * 1000)}`;

  if (field.type === 'String') {
    if (field.name.toLowerCase().includes('email')) {
      return `dummy-${index}-${Math.floor(Math.random() * 10000)}@giftfactory.local`;
    }
    if (field.name.toLowerCase().includes('phone')) {
      return `9199${String(index).padStart(2, '0')}${Math.floor(100000 + Math.random() * 900000)}`;
    }
    if (field.name.toLowerCase().includes('postal') || field.name.toLowerCase().includes('pin')) {
      return `5600${String(index % 100).padStart(2, '0')}`;
    }
    if (field.name.toLowerCase().includes('gstin') || field.name.toLowerCase().includes('gstnumber')) {
      return `29ABCDE1234F${index % 10}Z${index % 10}`;
    }
    if (field.name.toLowerCase().includes('pan')) {
      return `ABCDE123${index % 10}F`;
    }
    if (field.name.toLowerCase().includes('image') || field.name.toLowerCase().includes('avatar') || field.name.toLowerCase().includes('logo') || field.name.toLowerCase().includes('url')) {
      return getBackupImage(index);
    }
    if (field.isUnique || field.name === 'slug' || field.name === 'code') {
      return `seed-unique-${field.name}-${index}-${Math.floor(Math.random() * 10000)}`;
    }
    return `dummy-${field.name}-${index}`;
  }

  if (field.type === 'Int') {
    return 10 + index;
  }

  if (field.type === 'Float') {
    return 10.0 + index;
  }

  if (field.type === 'Boolean') {
    return true;
  }

  if (field.type === 'DateTime') {
    return new Date();
  }

  if (field.type === 'Json') {
    return {};
  }

  if (field.type === 'Decimal') {
    return new Prisma.Decimal(10.0 + index);
  }

  return null;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
