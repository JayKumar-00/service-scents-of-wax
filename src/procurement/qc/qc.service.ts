import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateQcDto } from './dto/create-qc.dto';
import { QcQueryDto } from './dto/qc-query.dto';
import { paginatePrisma, buildSearchFilter } from '../../common/utils/pagination.util';
import { OrderType } from '../../common/dto/query.dto';
import { QualityInspectionStatus } from '@prisma/client';
import { generateQcReportHtml, QcReportData } from './utils/qc-report.template';
import { PdfGenerator } from '../../common/utils/pdf-generator.util';

@Injectable()
export class QcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateQcDto) {
    const inspection = await this.prisma.qualityInspection.create({
      data: {
        grnId: dto.grnId,
        grnLineId: dto.grnLineId || null,
        status: 'PENDING',
        notes: dto.notes,
      },
    });

    await this.audit.log({
      userId: 'system',
      action: 'CREATE_QC_INSPECTION',
      resource: 'QualityInspection',
      resourceId: inspection.id,
      metadata: { grnId: dto.grnId },
    });

    return inspection;
  }

  async list(query: QcQueryDto) {
    const clauses: Record<string, any>[] = [];

    if (query.status) {
      clauses.push({ status: query.status });
    }

    if (query.grnId) {
      clauses.push({ grnId: query.grnId });
    }

    if (query.search) {
      const searchFilter = buildSearchFilter(query.search, [
        'notes',
        'grn.grnNumber',
      ]);
      if (Object.keys(searchFilter).length > 0) {
        clauses.push(searchFilter);
      }
    }

    const where = clauses.length > 0 ? { AND: clauses } : {};

    const allowedSortFields = ['createdAt', 'status'];
    const sortField = allowedSortFields.includes(query.sortBy || '')
      ? (query.sortBy as string)
      : 'createdAt';
    const direction = query.order || OrderType.DESC;
    const orderBy: Record<string, OrderType> = { [sortField]: direction };

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const paged = await paginatePrisma<any>({
      model: this.prisma.qualityInspection as any,
      where,
      orderBy,
      page,
      limit,
      include: { grn: true },
    });

    return {
      data: paged.data || [],
      meta: paged.meta,
    };
  }

  async approve(id: string) {
    return this.updateStatus(id, 'PASSED', 'system');
  }

  async updateStatus(id: string, status: QualityInspectionStatus, userId: string = 'system') {
    return this.prisma.$transaction(async (tx) => {
      const inspection = await tx.qualityInspection.findUnique({
        where: { id },
        include: { grn: true },
      });

      if (!inspection) {
        throw new NotFoundException('Quality inspection not found');
      }

      const updated = await tx.qualityInspection.update({
        where: { id },
        data: {
          status,
          ...(status === 'PASSED' ? { approvedAt: new Date() } : {}),
        },
      });

      if ((status === 'PASSED' || status === 'PARTIAL') && inspection.grn?.asnId) {
        await tx.asn.update({
          where: { id: inspection.grn.asnId },
          data: { status: 'ARRIVED' },
        });
      }

      if (status === 'PASSED') {
        const grnLines = await tx.grnLine.findMany({
          where: inspection.grnLineId
            ? { id: inspection.grnLineId }
            : { grnId: inspection.grnId },
          include: { 
            purchaseOrderLine: {
              include: { purchaseOrder: true }
            } 
          },
        });

        const returnLines: any[] = [];
        let poId: string | null = null;
        let supplierId: string | null = null;

        for (const grnLine of grnLines) {
          if (grnLine.purchaseOrderLine) {
            const poLine = grnLine.purchaseOrderLine;
            
            const priceData: any = {};
            if (poLine.basePrice !== null && poLine.basePrice !== undefined) priceData.basePrice = poLine.basePrice;
            else priceData.basePrice = poLine.unitCost;
            
            if (poLine.wholesalePrice !== null && poLine.wholesalePrice !== undefined) priceData.wholesalePrice = poLine.wholesalePrice;
            if (poLine.price !== null && poLine.price !== undefined) priceData.price = poLine.price;
            if (poLine.mrpPrice !== null && poLine.mrpPrice !== undefined) priceData.mrpPrice = poLine.mrpPrice;

            if (Object.keys(priceData).length > 0) {
              if (poLine.variantId) {
                await tx.productVariant.update({
                  where: { id: poLine.variantId },
                  data: priceData,
                });
              } else {
                await tx.product.update({
                  where: { id: poLine.productId },
                  data: priceData,
                });
              }
            }

            // Handle Damaged Qty
            if (grnLine.damagedQty > 0) {
              await tx.warehouseDefectiveInventory.create({
                data: {
                  productId: poLine.productId,
                  variantId: poLine.variantId,
                  quantity: grnLine.damagedQty,
                  source: 'QC_REJECTED',
                  notes: `Damaged items from GRN ${grnLine.grnId}`,
                },
              });
            }

            // Handle Rejected Qty
            if (grnLine.rejectedQty > 0) {
              poId = poLine.purchaseOrderId;
              supplierId = poLine.purchaseOrder.supplierId;
              
              returnLines.push({
                productId: poLine.productId,
                variantId: poLine.variantId,
                quantity: grnLine.rejectedQty,
                unitCost: poLine.unitCost,
                lineTotal: Number(poLine.unitCost) * grnLine.rejectedQty,
                reason: `Rejected during QC for GRN ${grnLine.grnId}`,
              });
            }
          }
        }

        // Create Supplier Return Order if there are rejected lines
        if (returnLines.length > 0 && poId && supplierId) {
          const totalAmount = returnLines.reduce((sum, line) => sum + line.lineTotal, 0);
          
          await tx.supplierReturnOrder.create({
            data: {
              returnNumber: `RTV-${Date.now().toString().slice(-6)}`,
              purchaseOrderId: poId,
              supplierId: supplierId,
              status: 'DRAFT',
              totalAmount,
              notes: 'Auto-generated Return to Vendor from QC Rejections',
              lines: {
                create: returnLines,
              },
            },
          });
        }
      }

      await this.audit.log({
        userId,
        action: 'UPDATE_QC_INSPECTION_STATUS',
        resource: 'QualityInspection',
        resourceId: updated.id,
        metadata: { status: updated.status },
      });

      return updated;
    });
  }

  async generateReport(poNumber: string, type?: 'BASIC' | 'COMPLETE') {
    const normalizedType: 'BASIC' | 'COMPLETE' = String(type || '').toUpperCase() === 'COMPLETE' ? 'COMPLETE' : 'BASIC';

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { poNumber },
      include: {
        supplier: true,
        lines: {
          include: {
            product: true,
            variant: {
              include: {
                attributes: {
                  include: {
                    attributeValue: {
                      include: { attributeName: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!po) {
      throw new NotFoundException(`Purchase order with PO Number ${poNumber} not found`);
    }

    const asns = normalizedType === 'COMPLETE'
      ? await this.prisma.asn.findMany({
          where: { purchaseOrderId: po.id },
          include: {
            lines: {
              include: {
                product: true,
                variant: {
                  include: {
                    attributes: {
                      include: {
                        attributeValue: {
                          include: { attributeName: true }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      : [];

    const grns = await this.prisma.goodsReceiptNote.findMany({
      where: { purchaseOrderId: po.id },
      include: {
        asn: true,
        lines: {
          include: {
            product: true,
            variant: {
              include: {
                attributes: {
                  include: {
                    attributeValue: {
                      include: { attributeName: true }
                    }
                  }
                }
              }
            },
            qualityInspection: true,
          }
        },
        qualityInspections: true,
      }
    });

    const formatDate = (date?: Date | string | null) => {
      if (!date) return undefined;
      const d = new Date(date);
      if (isNaN(d.getTime())) return undefined;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatDateTime = (date?: Date | string | null) => {
      if (!date) return undefined;
      const d = new Date(date);
      if (isNaN(d.getTime())) return undefined;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    };

    const getVariantName = (variantObj: any) => {
      if (!variantObj) return undefined;
      if (Array.isArray(variantObj.attributes) && variantObj.attributes.length > 0) {
        const formattedAttrs = variantObj.attributes
          .map((a: any) => {
            const attrName = a?.attributeValue?.attributeName?.title || a?.attributeValue?.attributeName?.name || '';
            const attrVal = a?.attributeValue?.title || a?.attributeValue?.value || '';
            if (attrName && attrVal) {
              return `${String(attrName).toUpperCase()}: ${String(attrVal).toUpperCase()}`;
            }
            return attrVal ? String(attrVal).toUpperCase() : '';
          })
          .filter(Boolean);

        if (formattedAttrs.length > 0) {
          return formattedAttrs.join(', ');
        }
      }
      if (variantObj.name || variantObj.title || variantObj.sku) {
        return String(variantObj.name || variantObj.title || variantObj.sku).toUpperCase();
      }
      return undefined;
    };

    const cleanRemarks = (rawNotes?: string | null) => {
      if (!rawNotes) return '';
      let str = String(rawNotes).trim();
      if (!str) return '';
      str = str.replace(/Auto-generated QC inspection for line\s+[a-z0-9_]{10,40}\s+of GRN\s+([A-Z0-9_-]+)/gi, 'Auto-generated QC inspection');
      str = str.replace(/for line\s+[a-z0-9_]{10,40}\s+of GRN\s+([A-Z0-9_-]+)/gi, 'for GRN $1');
      str = str.replace(/for line\s+[a-z0-9_]{10,40}/gi, '');
      str = str.replace(/\b[a-z0-9]{20,35}\b/gi, '');
      str = str.replace(/\s+/g, ' ').trim();
      if (!str || str === 'for' || str === 'of') return 'Auto-generated QC inspection';
      return str;
    };

    const inspectionsData: QcReportData['inspections'] = [];

    for (const grn of grns) {
      // Line-level inspections
      for (const line of grn.lines) {
        if (line.qualityInspection) {
          inspectionsData.push({
            grnNumber: grn.grnNumber,
            productName: line.product?.name || 'Unknown Item',
            variantName: getVariantName(line.variant),
            receivedQty: line.receivedQty,
            acceptedQty: line.acceptedQty,
            damagedQty: line.damagedQty,
            rejectedQty: line.rejectedQty,
            status: line.qualityInspection.status,
            qcTime: formatDateTime((line.qualityInspection as any).approvedAt || line.qualityInspection.createdAt) || 'N/A',
            notes: cleanRemarks(line.qualityInspection.notes),
          });
        }
      }

      // Overall GRN-level inspections
      const grnLevelInspections = grn.qualityInspections.filter((qi: any) => qi.grnLineId === null);
      for (const qi of grnLevelInspections) {
        const totalReceived = grn.lines.reduce((sum: number, l: any) => sum + l.receivedQty, 0);
        const totalAccepted = grn.lines.reduce((sum: number, l: any) => sum + l.acceptedQty, 0);
        const totalDamaged = grn.lines.reduce((sum: number, l: any) => sum + l.damagedQty, 0);
        const totalRejected = grn.lines.reduce((sum: number, l: any) => sum + l.rejectedQty, 0);

        inspectionsData.push({
          grnNumber: grn.grnNumber,
          productName: 'All Items in GRN',
          receivedQty: totalReceived,
          acceptedQty: totalAccepted,
          damagedQty: totalDamaged,
          rejectedQty: totalRejected,
          status: qi.status,
          qcTime: formatDateTime((qi as any).approvedAt || qi.createdAt) || 'N/A',
          notes: cleanRemarks(qi.notes),
        });
      }
    }

    let poLines: QcReportData['poLines'] = undefined;
    let asnDetails: QcReportData['asns'] = undefined;
    let grnDetails: QcReportData['grns'] = undefined;

    if (normalizedType === 'COMPLETE') {
      poLines = (po.lines || []).map((l: any) => ({
        productName: l.product?.name || 'Unknown Item',
        variantName: getVariantName(l.variant),
        orderedQty: l.orderedQty,
        unitCost: l.unitCost,
        lineTotal: l.lineTotal || (Number(l.orderedQty) * Number(l.unitCost)),
      }));

      asnDetails = asns.map((asn: any) => ({
        asnNumber: asn.asnNumber,
        status: asn.status,
        supplierInvoiceNo: asn.supplierInvoiceNo || undefined,
        vehicleNumber: asn.vehicleNumber || undefined,
        courier: asn.courier || undefined,
        trackingNumber: asn.trackingNumber || undefined,
        expectedArrival: formatDate(asn.expectedArrival),
        shipmentNote: asn.shipmentNote || undefined,
        createdAt: formatDateTime(asn.createdAt),
        lines: (asn.lines || []).map((l: any) => ({
          productName: l.product?.name || 'Unknown Item',
          variantName: getVariantName(l.variant),
          expectedQty: l.expectedQty,
        })),
      }));

      grnDetails = grns.map((grn: any) => ({
        grnNumber: grn.grnNumber,
        status: grn.status,
        asnNumber: grn.asn?.asnNumber || undefined,
        createdAt: formatDateTime(grn.createdAt),
        lines: (grn.lines || []).map((l: any) => ({
          productName: l.product?.name || 'Unknown Item',
          variantName: getVariantName(l.variant),
          receivedQty: l.receivedQty,
          acceptedQty: l.acceptedQty,
          damagedQty: l.damagedQty,
          rejectedQty: l.rejectedQty,
          notes: cleanRemarks(l.qualityInspection?.notes || l.notes),
        })),
      }));
    }

    const reportData: QcReportData = {
      reportType: normalizedType,
      poNumber: po.poNumber,
      poStatus: po.status,
      poTime: formatDateTime((po as any).createdAt || (po as any).order_date || (po as any).orderDate),
      expectedDeliveryDate: formatDate(po.expectedDeliveryDate),
      currency: po.currency || 'INR',
      totalAmount: po.totalAmount ? String(po.totalAmount) : undefined,
      notes: po.notes || undefined,
      reportNumber: `QCR-${po.poNumber.replace(/^PO-?/, '')}`,
      supplierName: po.supplier?.name || 'Unknown Supplier',
      supplierPhone: po.supplier?.phone || undefined,
      supplierEmail: po.supplier?.email || undefined,
      supplierAddress: po.supplier?.address || undefined,
      supplierGst: po.supplier?.gstNumber || undefined,
      poDate: formatDate((po as any).orderDate || (po as any).createdAt),
      reportDate: formatDate(new Date()) || '',
      poLines,
      asns: asnDetails,
      grns: grnDetails,
      inspections: inspectionsData,
    };

    return generateQcReportHtml(reportData);
  }

  async generatePdfReport(poNumber: string, type?: 'BASIC' | 'COMPLETE'): Promise<Buffer> {
    const html = await this.generateReport(poNumber, type);
    return PdfGenerator.generateFromHtml(html, { noHeaderFooter: true });
  }
}


