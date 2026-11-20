import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Franchise,
  FranchiseStatus,
  KycStatus,
  Role,
  FranchiseDocument,
  NotificationType,
  NotificationChannel,
} from '@prisma/client';
import { AdminFranchiseQueryDto } from './dto/admin-franchise.query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { FranchiseDocumentDto } from '../../users/franchise/dto/franchise-document.dto';
import * as bcrypt from 'bcrypt';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import {
  buildSortOrder,
  paginatePrisma,
} from 'src/common/utils/pagination.util';
import { buildPrismaTextSearchFilter } from 'src/common/utils/search.util';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';
import { OrderType } from 'src/common/dto/query.dto';
import { CreateFranchiseDto } from './dto/create-franchise.dto';
import { UpdateFranchiseDto } from './dto/update-franchise.dto';
import { randomBytes } from 'crypto';
import { AuditService } from 'src/audit/audit.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { LocationService } from 'src/geo/location.service';
import { buildAddressString } from 'src/geo/utils/build-address';
import { BrevoService } from 'src/notification/services/brevo.service';
import { FranchiseActivationTemplate } from 'src/notification/templates/franchise-activation.template';
import { StarterBundlesService } from '../../starter-bundles/starter-bundles.service';

@Injectable()
export class AdminFranchiseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locationService: LocationService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly brevoService: BrevoService,
    private readonly starterBundlesService: StarterBundlesService,
  ) {}

  private buildFranchiseSortOrder = (
    sortBy: string | undefined,
    order: OrderType | undefined,
  ): Record<string, OrderType> =>
    buildSortOrder(sortBy, order, ['createdAt', 'name']);

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private mapFranchiseDocuments(
    documents: FranchiseDocumentDto[] | undefined,
    uploadedByUserId: string,
  ) {
    return (documents ?? []).map((document) => ({
      kind: document.kind,
      title: document.title.trim(),
      fileUrl: document.fileUrl.trim(),
      uploadedByUserId,
    }));
  }

  private async autoAssignStarterBundle(
    franchiseId: string,
    actorUserId: string,
    ip: string,
  ) {
    try {
      const defaultBundle = await this.prisma.starterBundle.findFirst({
        where: {
          status: 'ACTIVE',
          OR: [{ isDefault: true }, { autoAssignOnCreate: true }],
        },
      });

      if (defaultBundle) {
        // Let's check if already assigned
        const existingAssignment = await this.prisma.franchiseBundleAssignment.findUnique({
          where: {
            franchiseId_bundleId: {
              franchiseId,
              bundleId: defaultBundle.id,
            },
          },
        });

        if (!existingAssignment) {
          await this.starterBundlesService.assignBundle(
            defaultBundle.id,
            franchiseId,
            actorUserId,
            ip,
          );
        }
      }
    } catch (error: any) {
      console.error(
        `Failed to auto-assign starter bundle for franchise ${franchiseId}: ${error.message}`,
      );
    }
  }

  async list(query?: AdminFranchiseQueryDto): Promise<{
    data: (Franchise & {
      documents: FranchiseDocument[];
      _count: { orders: number; users: number };
    })[];
    meta: IMeta;
  }> {
    const q: any = query ?? {};

    const clauses: Record<string, unknown>[] = [];

    // text search using shared utility
    const searchFilter = buildPrismaTextSearchFilter(q.search, [
      'name',
      'code',
      'ownerFullName',
      'ownerPhone',
      'ownerEmail',
      'businessName',
      'gstNumber',
      'panNumber',
      'territory',
      'state',
      'city',
    ]);

    if (Object.keys(searchFilter).length > 0) {
      clauses.push(searchFilter);
    }

    if (q.status) {
      clauses.push({ status: q.status });
    }

    if (q.kycStatus) {
      clauses.push({ kycStatus: q.kycStatus });
    }

    if (q.email) {
      clauses.push({
        ownerEmail: { equals: q.email.trim(), mode: 'insensitive' },
      });
    }

    if (q.ownerEmail) {
      clauses.push({
        ownerEmail: { equals: q.ownerEmail.trim(), mode: 'insensitive' },
      });
    }

    if (q.ownerPhone) {
      clauses.push({ ownerPhone: { contains: q.ownerPhone.trim() } });
    }

    if (q.ownerFullName) {
      clauses.push({
        ownerFullName: {
          contains: q.ownerFullName.trim(),
          mode: 'insensitive',
        },
      });
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;

    const orderBy = this.buildFranchiseSortOrder(q.sortBy, q.order);

    // const cacheKey = `admin:franchises:page=${page}:limit=${limit}:order=${q.order ?? ''}:sortBy=${q.sortBy ?? ''}:search=${encodeURIComponent(
    //   String(q.search ?? ''),
    // )}:status=${q.status ?? ''}:kycStatus=${q.kycStatus ?? ''}`;

    // const cached = await this.redisService.get<{
    //   data: (Franchise & {
    //     documents: FranchiseDocument[];
    //     _count: { orders: number; users: number };
    //   })[];
    //   meta: IMeta;
    // }>(cacheKey);

    // if (cached) {
    //   return cached;
    // }

    const result = await paginatePrisma<
      Franchise & {
        documents: FranchiseDocument[];
        _count: { orders: number; users: number };
      }
    >({
      model: this.prisma.franchise as any,
      where,
      orderBy,
      page,
      limit,
      include: {
        users: {
          select: { id: true, email: true, role: true, bank: true },
        },
        documents: { orderBy: { createdAt: 'asc' } },
        _count: { select: { orders: true, users: true } },
        bundleAssignments: {
          include: {
            bundle: {
              include: {
                items: {
                  include: {
                    product: { select: { id: true, name: true, slug: true } },
                    variant: { select: { id: true, sku: true, attributeSummary: true } },
                  },
                },
              },
            },
            stockRequest: {
              select: { id: true, status: true, paymentStatus: true, type: true },
            },
            inboundDelivery: {
              select: { id: true, status: true, trackingCode: true },
            },
          },
        },
      },
    });

    const awsPrefix = this.configService
      .get<string>('AWS_PREFIX_URL')
      ?.replace(/\/$/, '');

    const data = result.data.map((fr) => ({
      ...fr,
      documents: (fr.documents ?? []).map((d) => ({
        ...d,
        fileUrl: awsPrefix ? `${awsPrefix}/${d.fileUrl}` : d.fileUrl,
      })),
    }));

    const payload = {
      data,
      meta: result.meta,
    };

    // await this.redisService.set(cacheKey, payload);

    return payload;
  }

  async findOne(franchiseId: string) {
    const cacheKey = `admin:franchise:${franchiseId}`;
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) return cached;

    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      include: {
        users: {
          select: { id: true, email: true, role: true, bank: true },
        },
        documents: { orderBy: { createdAt: 'asc' } },
        _count: { select: { orders: true, users: true } },
        bundleAssignments: {
          include: {
            bundle: {
              include: {
                items: {
                  include: {
                    product: { select: { id: true, name: true, slug: true } },
                    variant: { select: { id: true, sku: true, attributeSummary: true } },
                  },
                },
              },
            },
            stockRequest: {
              select: { id: true, status: true, paymentStatus: true, type: true },
            },
            inboundDelivery: {
              select: { id: true, status: true, trackingCode: true },
            },
          },
        },
      },
    });
    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }

    const franchiseRecord = franchise as Franchise & {
      documents: FranchiseDocument[];
      _count: { orders: number; users: number };
    };

    const awsPrefix = this.configService
      .get<string>('AWS_PREFIX_URL')
      ?.replace(/\/$/, '');

    const result = {
      ...franchiseRecord,
      documents: (franchiseRecord.documents ?? []).map((d) => ({
        ...d,
        fileUrl: awsPrefix ? `${awsPrefix}/${d.fileUrl}` : d.fileUrl,
      })),
    };

    await this.redisService.set(cacheKey, result);

    return result;
  }

  private async notifyNewFranchiseRegistration(franchise: any) {
    console.log(
      `Notifying SuperAdmins about new franchise registration: ${franchise.name} (${franchise.ownerFullName})`,
    );
    try {
      const user = await this.prisma.user.findFirstOrThrow({
        where: { role: Role.SUPERADMIN },
      });

      const title = 'New Franchise Registration';
      const body = `New franchise registration from ${franchise.ownerFullName} (${franchise.name}). Please review and approve the registration.`;

      // Create in-app notification and send email to each SuperAdmin
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          title,
          body,
          type: NotificationType.FRANCHISE_REGISTRATION,
          channel: NotificationChannel.IN_APP,
          metadata: {
            franchiseId: franchise.id,
            franchiseName: franchise.name,
            franchiseCode: franchise.code,
            ownerName: franchise.ownerFullName,
            ownerEmail: franchise.ownerEmail,
            kycStatus: franchise.kycStatus,
          },
        },
      });
    } catch (error: any) {
      console.error(
        `Failed to notify SuperAdmins about new franchise: ${error.message}`,
      );
      // Non-critical operation, don't throw
    }
  }

  async create(dto: CreateFranchiseDto, _actorUserId: string, ip: string) {
    const email = this.normalizeEmail(dto.ownerEmail);

    const passwordHash = await bcrypt.hash(
      dto?.password ?? `franchise@123`,
      10,
    );

    if (!dto.latitude || !dto.longitude) {
      const address = buildAddressString({
        area: dto.addressLine1,
        city: dto.city,
        state: dto.state,
        country: dto.country,
      });

      if (!address) {
        throw new BadRequestException('At least one address field is required');
      }

      const {
        lat,
        lng,
        address: displayName,
      } = await this.locationService.geocode(address);

      if (!lat || !lng) {
        throw new BadRequestException('Unable to geocode the provided address');
      }

      dto.latitude = lat;
      dto.longitude = lng;
      dto.territory = displayName;

      if (!dto.latitude || !dto.longitude) {
        throw new BadRequestException(
          'Valid address is required to fetch latitude and longitude',
        );
      }

      console.log(
        `Geocoded address "${address}" to lat: ${dto.latitude}, lng: ${dto.longitude}, territory: ${dto.territory}`,
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            role: Role.FRANCHISE_OWNER,
          },
          select: {
            id: true,
            email: true,
            role: true,
            franchiseId: true,
          },
        });

        const franchise = await tx.franchise.create({
          data: {
            name: dto.name,
            dob: dto.dob ?? null,
            gender: dto.gender,
            code: `GBLR-${user.id.slice(0, 8).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`,
            latitude: dto.latitude,
            longitude: dto.longitude,
            territory: dto.territory,
            state: dto.state ?? undefined,
            addressLine1: dto.addressLine1,
            city: dto.city,
            postalCode: dto.postalCode,
            country: dto.country ?? 'IN',
            ownerFullName: dto.ownerFullName ?? undefined,
            ownerPhone: dto.ownerPhone ?? undefined,
            ownerEmail: dto.ownerEmail,
            businessName: dto.businessName ?? undefined,
            gstNumber: dto.gstNumber ?? undefined,
            panNumber: dto.panNumber ?? undefined,
            kycDocumentType: dto.kycDocumentType ?? undefined,
            kycDocumentNumber: dto.kycDocumentNumber ?? undefined,
            kycStatus: KycStatus.PENDING,
            status: FranchiseStatus.INACTIVE,
            basicDetailsCompleted: !!(
              dto.ownerFullName &&
              dto.ownerPhone &&
              dto.ownerEmail
            ),
            gstDetailsCompleted: !!(
              dto.businessName &&
              dto.gstNumber &&
              dto.panNumber
            ),
            sopTrainingCompleted: dto.sopTrainingCompleted ?? false,
            sopBrandingCompleted: dto.sopBrandingCompleted ?? false,
            sopInfraAuditCompleted: dto.sopInfraAuditCompleted ?? false,
            sopPosSetupCompleted: dto.sopPosSetupCompleted ?? false,
            sopSafetyCompleted: dto.sopSafetyCompleted ?? false,
            sopChecklistCompleted:
              !!dto.sopTrainingCompleted &&
              !!dto.sopBrandingCompleted &&
              !!dto.sopInfraAuditCompleted &&
              !!dto.sopPosSetupCompleted &&
              !!dto.sopSafetyCompleted,
            sopLastReviewedAt:
              !!dto.sopTrainingCompleted &&
              !!dto.sopBrandingCompleted &&
              !!dto.sopInfraAuditCompleted &&
              !!dto.sopPosSetupCompleted &&
              !!dto.sopSafetyCompleted
                ? new Date()
                : undefined,
            sopNote: dto.sopNote ?? undefined,
          },
        });

        // Link the owner account to the franchise for relation-based lookups.
        await tx.user.update({
          where: { id: user.id },
          data: { franchiseId: franchise.id },
        });

        const documents = this.mapFranchiseDocuments(dto.documents, user.id);
        if (documents.length > 0) {
          await tx.franchiseDocument.createMany({
            data: documents.map((document) => ({
              ...document,
              franchiseId: franchise.id,
            })),
          });
        }

        return tx.franchise.findUnique({
          where: { id: franchise.id },
          include: {
            documents: { orderBy: { createdAt: 'asc' } },
            _count: { select: { orders: true, users: true } },
          },
        });
      },
      { timeout: 5000 },
    );

    fireAndForget(
      this.audit.log({
        userId: _actorUserId,
        action: 'franchise.create',
        resource: 'Franchise',
        resourceId: result.id,
        metadata: { code: result?.code, name: result?.name },
        ip,
      }),
      'audit-log-franchise-create',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('admin:franchises:'),
      'cache-clear-franchise',
    );

    // 📧 Notify SuperAdmins about new franchise registration
    fireAndForget(
      this.notifyNewFranchiseRegistration(result),
      'franchise-registration-notification',
    );

    // Assign starter bundle if explicitly passed in dto
    if (dto.bundleId) {
      fireAndForget(
        this.starterBundlesService.assignBundle(
          dto.bundleId,
          result.id,
          _actorUserId,
          ip,
        ),
        'franchise-manual-assign-bundle',
      );
    }

    return result!;
  }

  async update(
    franchiseId: string,
    dto: UpdateFranchiseDto,
    actorUserId: string,
    ip: string,
  ) {
    const existing = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
    });

    if (!existing) {
      throw new NotFoundException('Franchise not found');
    }

    const basicDetailsCompleted =
      dto.basicDetailsCompleted === undefined
        ? undefined
        : dto.basicDetailsCompleted === 'true';
    const gstDetailsCompleted =
      dto.gstDetailsCompleted === undefined
        ? undefined
        : dto.gstDetailsCompleted === 'true';
    const sopTrainingCompleted =
      dto.sopTrainingCompleted === undefined
        ? undefined
        : dto.sopTrainingCompleted === 'true';
    const sopBrandingCompleted =
      dto.sopBrandingCompleted === undefined
        ? undefined
        : dto.sopBrandingCompleted === 'true';
    const sopInfraAuditCompleted =
      dto.sopInfraAuditCompleted === undefined
        ? undefined
        : dto.sopInfraAuditCompleted === 'true';
    const sopPosSetupCompleted =
      dto.sopPosSetupCompleted === undefined
        ? undefined
        : dto.sopPosSetupCompleted === 'true';
    const sopSafetyCompleted =
      dto.sopSafetyCompleted === undefined
        ? undefined
        : dto.sopSafetyCompleted === 'true';
    const sopChecklistCompleted =
      dto.sopChecklistCompleted === undefined
        ? undefined
        : dto.sopChecklistCompleted === 'true';

    if (dto.addressLine1 || dto.city || dto.state || dto.country) {
      if (!dto.latitude || !dto.longitude) {
        const address = buildAddressString({
          area: dto.addressLine1,
          city: dto.city,
          state: dto.state,
          country: dto.country,
        });

        if (!address) {
          throw new BadRequestException(
            'At least one address field is required',
          );
        }

        const {
          lat,
          lng,
          address: displayName,
        } = await this.locationService.geocode(address);

        if (!lat || !lng) {
          throw new BadRequestException(
            'Unable to geocode the provided address',
          );
        }

        dto.latitude = lat;
        dto.longitude = lng;
        dto.territory = displayName;

        console.log(
          `Geocoded address "${address}" to lat: ${dto.latitude}, lng: ${dto.longitude}, territory: ${dto.territory}`,
        );
      } else if (!dto.latitude || !dto.longitude) {
        throw new BadRequestException(
          'Valid address is required when updating location',
        );
      }
    }

    const targetSopChecklist =
      sopChecklistCompleted ??
      existing.sopChecklistCompleted ??
      ((sopTrainingCompleted ?? existing.sopTrainingCompleted) &&
        (sopBrandingCompleted ?? existing.sopBrandingCompleted) &&
        (sopInfraAuditCompleted ?? existing.sopInfraAuditCompleted) &&
        (sopPosSetupCompleted ?? existing.sopPosSetupCompleted) &&
        (sopSafetyCompleted ?? existing.sopSafetyCompleted));

    // const isActivationReady =
    //   (dto.basicDetailsCompleted ?? existing.basicDetailsCompleted) &&
    //   (dto.gstDetailsCompleted ?? existing.gstDetailsCompleted) &&
    //   targetSopChecklist &&
    //   (dto.kycStatus ?? existing.kycStatus) === KycStatus.APPROVED;

    // if (existing.status === FranchiseStatus.ACTIVE && !isActivationReady) {
    //   throw new BadRequestException(
    //     'Cannot break active franchise requirements',
    //   );
    // }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        // 1. Password reset (safe batch)
        if (dto.isPasswordReset === 'true') {
          const passwordHash = await bcrypt.hash(
            `franchise@${Math.floor(1000 + Math.random() * 9000)}`,
            10,
          );

          await tx.user.updateMany({
            where: { franchiseId },
            data: { passwordHash },
          });
        }

        // 2. Documents (UPSERT only — NO DELETE ALL)
        if (dto.documents?.length) {
          const upserts = dto.documents
            .filter((doc) => doc.kind)
            .map((doc) =>
              tx.franchiseDocument.upsert({
                where: {
                  franchiseId_kind: {
                    franchiseId: existing.id,
                    kind: doc.kind!,
                  },
                },
                update: {
                  title: doc.title,
                  fileUrl: doc.fileUrl,
                },
                create: {
                  ...doc,
                  franchiseId: existing.id,
                  uploadedByUserId: actorUserId,
                },
              }),
            );

          const newDocs = dto.documents
            .filter((doc) => !doc.kind)
            .map((doc) => ({
              ...doc,
              franchiseId: existing.id,
              uploadedByUserId: actorUserId,
            }));

          const creates = newDocs.length
            ? tx.franchiseDocument.createMany({
                data: newDocs,
              })
            : null;

          await Promise.all([...upserts, creates].filter(Boolean));
        }

        // 3. Build SAFE update payload
        const data: any = {};

        const set = (key: string, value: any, existingValue: any) => {
          if (value !== undefined && value !== existingValue) {
            data[key] = value;
          }
        };

        set('name', dto.name, existing.name);
        set('dob', dto.dob, existing.dob);
        set('gender', dto.gender, existing.gender);
        set('latitude', dto.latitude, existing.latitude);
        set('longitude', dto.longitude, existing.longitude);
        set('territory', dto.territory, existing.territory);
        set('state', dto.state, existing.state);
        set('city', dto.city, existing.city);
        set('country', dto.country, existing.country);
        set('postalCode', dto.postalCode, existing.postalCode);
        set('addressLine1', dto.addressLine1, existing.addressLine1);

        set('ownerFullName', dto.ownerFullName, existing.ownerFullName);
        set('ownerPhone', dto.ownerPhone, existing.ownerPhone);

        if (dto.ownerEmail && dto.ownerEmail !== existing.ownerEmail) {
          data.ownerEmail = this.normalizeEmail(dto.ownerEmail);
        }

        set('businessName', dto.businessName, existing.businessName);
        set('gstNumber', dto.gstNumber, existing.gstNumber);
        set('panNumber', dto.panNumber, existing.panNumber);
        set('territory', dto.territory, existing.territory);
        set('kycNote', dto.kycNote, existing.kycNote);
        set('sopNote', dto.sopNote, existing.sopNote);

        if (dto.kycStatus && dto.kycStatus !== existing.kycStatus) {
          data.kycStatus = dto.kycStatus;
          data.kycVerifiedAt =
            dto.kycStatus === KycStatus.APPROVED ? new Date() : null;
        }

        // SOP fields
        set(
          'basicDetailsCompleted',
          basicDetailsCompleted,
          existing.basicDetailsCompleted,
        );

        if (gstDetailsCompleted !== undefined) {
          console.log(
            `Normalizing gstDetailsCompleted value: ${dto.gstDetailsCompleted} to boolean for franchise ${franchiseId}`,
          );
          data.gstDetailsCompleted = gstDetailsCompleted;
        }

        if (sopTrainingCompleted !== undefined) {
          console.log(
            `Normalizing sopTrainingCompleted value: ${dto.sopTrainingCompleted} to boolean for franchise ${franchiseId}`,
          );
          data.sopTrainingCompleted = sopTrainingCompleted;
        }

        // set(
        //   'gstDetailsCompleted',
        //   dto.gstDetailsCompleted,
        //   existing.gstDetailsCompleted,
        // );
        // set(
        //   'sopTrainingCompleted',
        //   dto.sopTrainingCompleted,
        //   existing.sopTrainingCompleted,
        // );
        set(
          'sopBrandingCompleted',
          sopBrandingCompleted,
          existing.sopBrandingCompleted,
        );
        set(
          'sopInfraAuditCompleted',
          sopInfraAuditCompleted,
          existing.sopInfraAuditCompleted,
        );
        set(
          'sopPosSetupCompleted',
          sopPosSetupCompleted,
          existing.sopPosSetupCompleted,
        );
        set(
          'sopSafetyCompleted',
          sopSafetyCompleted,
          existing.sopSafetyCompleted,
        );

        if (targetSopChecklist !== existing.sopChecklistCompleted) {
          data.sopChecklistCompleted = targetSopChecklist;
          data.sopLastReviewedAt = targetSopChecklist ? new Date() : null;
        }

        const booleanFields = [
          'basicDetailsCompleted',
          'gstDetailsCompleted',
          'sopChecklistCompleted',
          'sopTrainingCompleted',
          'sopBrandingCompleted',
          'sopInfraAuditCompleted',
          'sopPosSetupCompleted',
          'sopSafetyCompleted',
        ] as const;

        for (const field of booleanFields) {
          if (typeof data[field] === 'string') {
            data[field] = data[field] === 'true';
          }
        }

        // 4. Only update if needed
        if (Object.keys(data).length > 0) {
          await tx.franchise.update({
            where: { id: franchiseId },
            data,
          });
        }

        return tx.franchise.findUnique({
          where: { id: franchiseId },
          include: {
            documents: true,
            _count: true,
          },
        });
      },
      { timeout: 10000 },
    );

    // side effects safe
    fireAndForget(
      this.audit.log({
        userId: actorUserId,
        action: 'franchise.update',
        resource: 'Franchise',
        resourceId: franchiseId,
        metadata: dto as any,
        ip,
      }),
    );

    fireAndForget(this.redisService.clearCacheByPrefix('admin:franchises:'));
    fireAndForget(this.redisService.del([`admin:franchise:${franchiseId}`]));

    // Assign starter bundle if explicitly passed in dto
    if (dto.bundleId) {
      fireAndForget(
        this.starterBundlesService.assignBundle(
          dto.bundleId,
          franchiseId,
          actorUserId,
          ip,
        ),
        'franchise-manual-assign-bundle',
      );
    }

    return updated;
  }

  async deleteAll() {
    const [franchiseCount, linkedUserCount] = await Promise.all([
      this.prisma.franchise.count(),
      this.prisma.user.count({ where: { franchiseId: { not: null } } }),
    ]);

    await this.prisma.$transaction(
      async (tx) => {
        await tx.user.updateMany({
          where: { franchiseId: { not: null } },
          data: { franchiseId: null },
        });

        await tx.franchiseDocument.deleteMany({});
        await tx.inventoryReservation.deleteMany({});
        await tx.inboundDelivery.deleteMany({});
        await tx.franchiseReturn.deleteMany({});
        await tx.supportTicket.deleteMany({});
        await tx.franchiseNotice.deleteMany({});
        await tx.stockRequest.deleteMany({});
        await tx.order.deleteMany({});
        await tx.retailCustomer.deleteMany({});
        await tx.franchiseStock.deleteMany({});
        await tx.replenishmentPolicy.deleteMany({});
        await tx.franchise.deleteMany({});
      },
      { timeout: 60000 },
    );

    // Invalidate all franchise-related caches
    await this.redisService.clearCacheByPrefix('admin:franchises:');
    await this.redisService.clearCacheByPrefix('admin:franchise:');

    return {
      ok: true as const,
      deletedFranchises: franchiseCount,
      unlinkedUsers: linkedUserCount,
    };
  }

  async updateStatus(
    franchiseId: string,
    status: FranchiseStatus,
    actorUserId: string,
    ip: string,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1. Fetch INSIDE transaction (consistency ke liye)
        const existing = await tx.franchise.findUnique({
          where: { id: franchiseId },
          select: { status: true, approvedAt: true },
        });

        if (!existing) {
          throw new NotFoundException('Franchise not found');
        }

        if (status === existing.status) {
          throw new BadRequestException('Status already same');
        }

        if (
          existing.status === FranchiseStatus.ACTIVE &&
          status !== FranchiseStatus.INACTIVE
        ) {
          throw new BadRequestException('Invalid status transition');
        }

        // 2. Update
        const updated = await tx.franchise.update({
          where: { id: franchiseId },
          data: {
            status,
            ...(status === FranchiseStatus.ACTIVE && !existing.approvedAt
              ? {
                  approvedAt: new Date(),
                  approvedByUserId: actorUserId,
                }
              : {}),
          },
          select: {
            id: true,
            status: true,
            approvedAt: true,
          },
        });

        // 3. IMPORTANT: CreditAccount MUST succeed
        if (status === FranchiseStatus.ACTIVE && !existing.approvedAt) {
          try {
            await tx.creditAccount.upsert({
              where: { franchiseId },
              update: {},
              create: {
                franchiseId,
                totalCredit: 50000,
                usedCredit: 0,
                availableCredit: 50000,
              },
            });
          } catch (err) {
            throw new BadRequestException(
              `Failed to create credit account while activating franchise, ${(err as Error).message}`,
            );
          }
        }

        return {
          updated,
          previousStatus: existing.status,
        };
      },
      {
        // Give Prisma more time to acquire a writer connection under load.
        // `timeout` controls the transaction body; `maxWait` controls how long
        // Prisma waits to *start* the transaction.
        maxWait: 15000,
        timeout: 15000,
      },
    );

    // Side effects OUTSIDE (non-critical)
    fireAndForget(
      this.audit.log({
        userId: actorUserId,
        action: 'franchise.status_update',
        resource: 'Franchise',
        resourceId: franchiseId,
        metadata: {
          previousStatus: result.previousStatus,
          newStatus: status,
        },
        ip,
      }),
      'audit-log-franchise-status-update',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('admin:franchises:'),
      'cache-clear-franchise',
    );

    fireAndForget(
      this.redisService.del([`admin:franchise:${franchiseId}`]),
      'cache-clear-franchise',
    );

    // 📧 Send email notification when franchise becomes ACTIVE
    if (status === FranchiseStatus.ACTIVE) {
      fireAndForget(
        this.sendFranchiseActivationEmail(franchiseId),
        'franchise-activation-email',
      );
      fireAndForget(
        this.autoAssignStarterBundle(franchiseId, actorUserId, ip),
        'franchise-auto-assign-bundle',
      );
    }

    return result.updated;
  }

  private async sendFranchiseActivationEmail(franchiseId: string) {
    try {
      // Get franchise and owner details
      const franchise = await this.prisma.franchise.findUniqueOrThrow({
        where: { id: franchiseId },
        select: {
          id: true,
          name: true,
          code: true,
          ownerEmail: true,
          businessName: true,
        },
      });

      // await this.prisma.notification.create({
      //   data: {
      //     userId: franchise.id,
      //     title:'Franchise Activated - Welcome to the Network!',
      //     body:'',
      //     type: 'FRANCHISE_ACTIVATION' as any,
      //     channel: 'IN_APP',
      //     metadata: {
      //       franchiseId: franchise.id,
      //       franchiseName: franchise.name,
      //       franchiseCode: franchise.code,
      //     },
      //   },
      // });

      if (franchise.ownerEmail) {
        const html = FranchiseActivationTemplate.build({
          ownerName: franchise.name ?? 'Franchise Owner',
          businessName:
            franchise.businessName ?? `${franchise.name}'s Business`,
          franchiseCode: franchise.code,
        });

        await this.brevoService.sendEmail({
          to: franchise.ownerEmail,
          subject: 'Franchise Activated - Welcome to the Network!',
          htmlContent: html,
        });
      }
    } catch (error: any) {
      console.error(
        `Failed to send franchise activation email: ${error.message}`,
      );
      // Non-critical operation, don't throw
    }
  }

  async hardDelete(franchiseId: string) {
    const existing = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Franchise not found');
    }

    const linkedUserCount = await this.prisma.user.count({
      where: { franchiseId: franchiseId },
    });

    await this.prisma.$transaction(
      async (tx) => {
        const credit = await tx.creditAccount.findUnique({
          where: { franchiseId },
        });

        // Clear dues before deletion
        if (credit && credit.usedCredit > 0) {
          throw new BadRequestException(
            'Franchise has pending credit. Cannot delete.',
          );
        }

        // unlink users first to avoid foreign key restrictions
        await tx.user.updateMany({
          where: { franchiseId: franchiseId },
          data: { franchiseId: null },
        });

        // delete related records scoped to this franchise
        await tx.franchiseDocument.deleteMany({ where: { franchiseId } });
        await tx.inventoryReservation.deleteMany({ where: { franchiseId } });
        await tx.inboundDelivery.deleteMany({ where: { franchiseId } });
        await tx.franchiseReturn.deleteMany({ where: { franchiseId } });
        await tx.supportTicket.deleteMany({ where: { franchiseId } });
        await tx.franchiseNotice.deleteMany({ where: { franchiseId } });
        await tx.stockRequest.deleteMany({ where: { franchiseId } });
        await tx.order.deleteMany({ where: { franchiseId } });
        await tx.retailCustomer.deleteMany({ where: { franchiseId } });
        await tx.franchiseStock.deleteMany({ where: { franchiseId } });
        await tx.replenishmentPolicy.deleteMany({ where: { franchiseId } });
        await tx.creditAccount.deleteMany({ where: { franchiseId } });

        // finally remove the franchise record itself
        await tx.franchise.delete({ where: { id: franchiseId } });
      },
      { timeout: 60000 },
    );

    // Invalidate caches for lists and this franchise
    await this.redisService.clearCacheByPrefix('admin:franchises:');
    await this.redisService.del([`admin:franchise:${franchiseId}`]);

    return {
      ok: true as const,
      deletedFranchiseId: franchiseId,
      unlinkedUsers: linkedUserCount,
    };
  }

  async updateBadge(
    franchiseId: string,
    badge: string,
    _actorUserId: string,
    ip?: string,
  ) {
    const normalizedBadge = badge.trim();
    if (!normalizedBadge) {
      throw new BadRequestException('Badge is required');
    }

    const existing = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Franchise not found');
    }

    await this.prisma.franchise.update({
      where: { id: franchiseId },
      data: {
        badge: [normalizedBadge],
        updatedAt: new Date(),
      },
    });

    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      include: {
        documents: { orderBy: { createdAt: 'asc' } },
        _count: { select: { orders: true, users: true } },
      },
    });

    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }

    fireAndForget(
      this.audit.log({
        userId: _actorUserId,
        action: 'franchise.update_badge',
        resource: 'Franchise',
        resourceId: franchiseId,
        metadata: { badge: normalizedBadge },
        ip,
      }),
    );

    // Invalidate caches for lists and this franchise
    await this.redisService.clearCacheByPrefix('admin:franchises:');
    await this.redisService.del([`admin:franchise:${franchiseId}`]);

    return franchise;
  }

  async removeBadge(franchiseId: string, _actorUserId: string, ip?: string) {
    const existing = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Franchise not found');
    }

    await this.prisma.franchise.update({
      where: { id: franchiseId },
      data: {
        badge: [],
        updatedAt: new Date(),
      },
    });

    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      include: {
        documents: { orderBy: { createdAt: 'asc' } },
        _count: { select: { orders: true, users: true } },
      },
    });
    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }

    fireAndForget(
      this.audit.log({
        userId: _actorUserId,
        action: 'franchise.remove_badge',
        resource: 'Franchise',
        resourceId: franchiseId,
        ip,
      }),
    );

    // Invalidate caches for lists and this franchise
    await this.redisService.clearCacheByPrefix('admin:franchises:');
    await this.redisService.del([`admin:franchise:${franchiseId}`]);

    return franchise;
  }
}
