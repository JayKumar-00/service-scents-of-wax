import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LocationService } from 'src/geo/location.service';
import { buildAddressString } from 'src/geo/utils/build-address';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
  AddressQueryDto,
} from './dto';
import { AuditService } from 'src/audit/audit.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { Role } from '@prisma/client';

@Injectable()
export class AddressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locationService: LocationService,
    private readonly audit: AuditService,
  ) {}

  private async resolveCoordinates(
    dto: CreateCustomerAddressDto | UpdateCustomerAddressDto,
  ) {
    if (dto.latitude && dto.longitude) {
      return { latitude: dto.latitude, longitude: dto.longitude };
    }

    const hasAddress =
      dto.city ||
      dto.state ||
      dto.country ||
      dto.addressLine1 ||
      dto.addressLine2;

    if (hasAddress) {
      const address = buildAddressString({
        city: dto.city,
        state: dto.state,
        country: dto.country,
      });

      if (!address) {
        throw new BadRequestException('Invalid address provided');
      }

      const geo = await this.locationService.geocode(address);

      if (!geo?.lat || !geo?.lng) {
        throw new BadRequestException('Unable to geocode address');
      }

      return { latitude: geo.lat, longitude: geo.lng };
    }

    throw new BadRequestException(
      'Latitude/Longitude or valid address required',
    );
  }

  private async buildCreateData(
    dto: CreateCustomerAddressDto,
    customerId: string,
  ) {
    const coords = await this.resolveCoordinates(dto);

    return {
      fullName: dto.fullName,
      phone: dto.phone,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      city: dto.city,
      state: dto.state,
      postalCode: dto.postalCode,
      country: dto.country || 'INDIA',
      latitude: coords.latitude,
      longitude: coords.longitude,
      isDefault: dto.isDefault ?? false,
      customerId,
    };
  }

  async list(q: AddressQueryDto, page: number = 1, limit: number = 10) {
    const where: Record<string, unknown> = {};

    if (q.customerId) {
      where.customerId = q.customerId;
    }

    if (q.city) {
      where.city = { contains: q.city, mode: 'insensitive' };
    }

    if (q.state) {
      where.state = { contains: q.state, mode: 'insensitive' };
    }

    if (q.country) {
      where.country = { contains: q.country, mode: 'insensitive' };
    }

    if (typeof q.isDefault === 'boolean') {
      where.isDefault = q.isDefault;
    }

    if (q.search) {
      where.OR = [
        { fullName: { contains: q.search, mode: 'insensitive' } },
        { postalCode: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.customerAddress.count({ where }),
      this.prisma.customerAddress.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        count: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async add(userId: string, dto: CreateCustomerAddressDto, ip: string) {
    // Find the customer by userId
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found for the user');
    }

    const data = await this.buildCreateData(dto, customer.id);

    const [created] = await this.prisma.$transaction([
      this.prisma.customerAddress.create({
        data,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      }),
      ...(data.isDefault
        ? [
            this.prisma.customerAddress.updateMany({
              where: {
                customerId: customer.id,
                id: { not: undefined },
                isDefault: true,
              },
              data: { isDefault: false },
            }),
          ]
        : []),
    ]);

    fireAndForget(
      this.audit.log({
        userId: userId,
        action: 'CREATED',
        resource: 'ADDRESS',
        resourceId: created.id,
        metadata: { ...dto },
        ip,
      }),
      'ADD_ADDRESS',
    );
    return created;
  }

  async update(
    user: JwtUser,
    addressId: string,
    dto: UpdateCustomerAddressDto,
    ip: string,
  ) {
    const existing = await this.prisma.customerAddress.findUnique({
      where: { id: addressId },
      select: { id: true, customerId: true, isDefault: true },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    if (
      user.customerId !== existing?.customerId &&
      user.role !== Role.SUPERADMIN &&
      user.role !== Role.ADMIN_STAFF
    ) {
      throw new BadRequestException('NOT ALLOWED');
    }

    if (
      dto.addressLine1 ||
      dto.city ||
      dto.state ||
      dto.country ||
      dto.postalCode
    ) {
      const coords = await this.resolveCoordinates(dto);
      dto.latitude = dto.latitude ?? coords.latitude;
      dto.longitude = dto.longitude ?? coords.longitude;
    }

    const updateData: Record<string, unknown> = {
      ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.addressLine1 !== undefined && {
        addressLine1: dto.addressLine1,
      }),
      ...(dto.addressLine2 !== undefined && {
        addressLine2: dto.addressLine2,
      }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.state !== undefined && { state: dto.state }),
      ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.latitude !== undefined && { latitude: dto.latitude }),
      ...(dto.longitude !== undefined && { longitude: dto.longitude }),
    };

    if (typeof dto.isDefault === 'boolean') {
      updateData.isDefault = dto.isDefault;
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.customerAddress.update({
        where: { id: addressId },
        data: updateData,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      }),
      ...(dto.isDefault
        ? [
            this.prisma.customerAddress.updateMany({
              where: {
                customerId: existing.customerId,
                id: { not: addressId },
                isDefault: true,
              },
              data: { isDefault: false },
            }),
          ]
        : []),
    ]);

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'UPDATED',
        resource: 'ADDRESS',
        resourceId: addressId,
        metadata: { from: JSON.stringify(existing), to: JSON.stringify(dto) },
        ip,
      }),
      'UPDATE_ADDRESS',
    );
    return updated;
  }

  async delete(user: JwtUser, addressId: string, ip: string) {
    const address = await this.prisma.customerAddress.delete({
      where: { id: addressId },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'DELETED',
        resource: 'ADDRESS',
        resourceId: addressId,
        metadata: { deletedAddress: JSON.stringify(address) },
        ip,
      }),
      'DELETE_ADDRESS',
    );
    return { ok: true as const };
  }

  async setDefault(user: JwtUser, addressId: string, ip: string) {
    const existing = await this.prisma.customerAddress.findUnique({
      where: { id: addressId, customerId: user.customerId },
      select: { id: true, customerId: true },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.$transaction([
      this.prisma.customerAddress.updateMany({
        where: { customerId: existing.customerId, isDefault: true },
        data: { isDefault: false },
      }),

      this.prisma.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'UPDATED',
        resource: 'ADDRESS',
        resourceId: addressId,
        metadata: {
          from: JSON.stringify(existing),
          to: JSON.stringify({ ...existing, isDefault: true }),
        },
        ip,
      }),
      'UPDATE_ADDRESS',
    );

    return await this.prisma.customerAddress.findUniqueOrThrow({
      where: { id: addressId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });
  }
}
