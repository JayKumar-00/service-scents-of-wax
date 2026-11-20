import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationType } from 'src/notification/enums/notification-type.enum';
import { NotificationService } from 'src/notification/services/notification.service';
import { WebsocketService } from 'src/notification/services/websocket.service';
import { OrderAllocationEmitterService } from '../events/order-allocation-emitter.service';
import { ORDER_ALLOCATION_EVENTS } from '../constants/order-allocation.constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { BrevoService } from 'src/notification/services/brevo.service';
import { NotificationChannel } from 'src/notification/enums/notification-channel.enum';
import { Role, PaymentModeEnum, Prisma } from '@prisma/client';
import { CustomerOrderCreateTemplate } from 'src/notification/templates/customer-order-create.template';
import { OrderConfimationTemplate } from 'src/notification/templates/order-confirmation.template';
import { InvoiceTemplate } from 'src/notification/templates/invoice.template';
import { InvoiceHtmlBuilder } from 'src/invoice/template/invoice-html.builder';
import { PdfGenerator } from 'src/common/utils/pdf-generator.util';
import { InvoiceService } from 'src/invoice/invoice.service';

@Injectable()
export class OrderAllocationNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(
    OrderAllocationNotificationsService.name,
  );

  constructor(
    private readonly emitter: OrderAllocationEmitterService,
    private readonly notificationService: NotificationService,
    private readonly websocketService: WebsocketService,
    private readonly prisma: PrismaService,
    private readonly brevoService: BrevoService,
    private readonly invoiceService: InvoiceService,
  ) {}

  private async sendInvoiceEmail(orderId: string) {
    try {
      const existingEmail = await this.prisma.notification.findFirst({
        where: {
          channel: NotificationChannel.EMAIL,
          metadata: {
            path: ['orderId'],
            equals: orderId,
          },
          title: 'Order Email: INVOICE',
        },
      });
      if (existingEmail) {
        this.logger.log(`Invoice email already sent for order ${orderId}. Skipping.`);
        return;
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          invoiceNumber: true,
          isApproved: true,
          customer: {
            select: {
              name: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          retailCustomer: true,
        },
      });

      if (!order) return;

      let invoiceNumber = order.invoiceNumber;
      if (!invoiceNumber) {
        try {
          const invoice = await this.invoiceService.generatedInvoice({
            orderNumber: order.orderNumber,
          } as any);
          invoiceNumber = invoice.invoiceNumber;
        } catch (invoiceError: any) {
          this.logger.error(
            `Failed to generate invoice in sendInvoiceEmail for order ${order.orderNumber}: ${invoiceError.message}`,
          );
        }
      }

      const customerEmail =
        order?.customer?.user?.email || order.retailCustomer?.email;
      if (!customerEmail) {
        this.logger.warn(
          `No email found for customer in order ${order.orderNumber}`,
        );
        return;
      }

      const customerName =
        order.customer?.name || order.retailCustomer?.name || 'Customer';

      let attachments: Array<{ content: string; name: string }> | undefined =
        undefined;

      if (invoiceNumber) {
        try {
          const invoiceViewModel = await this.invoiceService.getInvoiceByNumber(
            invoiceNumber,
            { role: Role.SUPERADMIN } as any,
          );
          const htmlContent = InvoiceHtmlBuilder.build(invoiceViewModel, {
            autoPrint: false,
          });
          const pdfBuffer = await PdfGenerator.generateFromHtml(htmlContent, {
            noHeaderFooter: true,
          });
          attachments = [
            {
              content: pdfBuffer.toString('base64'),
              name: `Invoice-${invoiceNumber}.pdf`,
            },
          ];
        } catch (pdfError: any) {
          this.logger.error(
            `Failed to generate PDF attachment for order ${order.orderNumber}: ${pdfError.message}`,
          );
        }
      }

      const statusText = order.isApproved
        ? 'has been successfully confirmed and approved'
        : 'has been received and is being processed';

      const emailHtml = InvoiceTemplate.build({
        customerName,
        orderNumber: order.orderNumber,
        statusText,
      });

      await this.brevoService.sendEmail({
        to: customerEmail,
        subject: `Your Order Invoice - ${order.orderNumber}`,
        htmlContent: emailHtml,
        attachment: attachments,
      });

      this.logger.log(
        `Invoice email sent to customer ${customerEmail} for order ${order.orderNumber}`,
      );

      // Create notification log to prevent duplicate
      await this.prisma.notification.create({
        data: {
          userId: order.customer?.user?.id || order.retailCustomer?.id || '',
          title: 'Order Email: INVOICE',
          body: `Invoice email sent for order ${order.orderNumber}`,
          type: NotificationType.ORDER,
          channel: NotificationChannel.EMAIL,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
          },
        },
      });
    } catch (emailError: any) {
      this.logger.error(
        `Failed to send invoice email for order ${orderId}: ${emailError.message}`,
      );
    }
  }

  onModuleInit() {
    this.emitter.on(
      ORDER_ALLOCATION_EVENTS.ORDER_REQUEST_CREATED,
      async (payload) => {
        let dbNotification;
        try {
          let bodyText = 'Your order request has been received and is being processed.';
          try {
            const orderRequest = await this.prisma.orderRequest.findUnique({
              where: { id: payload.requestId },
              include: {
                items: {
                  select: {
                    productName: true,
                    quantity: true,
                  },
                },
              },
            });

            if (orderRequest && orderRequest.items && orderRequest.items.length > 0) {
              const productSummary = orderRequest.items
                .map((item) => `${item.productName} (x${item.quantity})`)
                .join(', ');
              bodyText = `Your order request for ${productSummary} has been received.`;
            }
          } catch (dbErr: any) {
            this.logger.error(
              `Failed to fetch order request items for notification: ${dbErr.message}`,
            );
          }

          dbNotification = await this.prisma.notification.create({
            data: {
              userId: payload.customerUId,
              title: 'Order request created',
              body: bodyText,
              type: NotificationType.ORDER,
              channel: NotificationChannel.IN_APP,
              metadata: payload as any,
            },
          });
        } catch (err: any) {
          this.logger.error(
            `Failed to create order request created notification: ${err.message}`,
          );
        }

        await this.websocketService.send(payload.customerUId, {
          event: ORDER_ALLOCATION_EVENTS.ORDER_REQUEST_CREATED,
          payload,
          ...(dbNotification ? dbNotification : {}),
        });

        // 2. Send Order Placement/Checkout Email Notification
        try {
          const order = await this.prisma.order.findFirst({
            where: { orderRequestId: payload.requestId },
            include: {
              customer: {
                select: {
                  name: true,
                  user: { select: { email: true, id: true } },
                },
              },
              retailCustomer: true,
            },
          });
          if (order) {
            const isOnline = order.paymentMode === PaymentModeEnum.ONLINE;
            
            // Check for duplicate send
            const existingEmail = await this.prisma.notification.findFirst({
              where: {
                channel: NotificationChannel.EMAIL,
                metadata: {
                  path: ['orderId'],
                  equals: order.id,
                },
                title: 'Order Email: CREATE',
              },
            });

            if (!existingEmail) {
              const customerEmail = order.customer?.user?.email || order.retailCustomer?.email;
              const customerName = order.customer?.name || order.retailCustomer?.name || 'Customer';
              
              if (customerEmail) {
                const emailHtml = CustomerOrderCreateTemplate.build({
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  totalAmount: order.total.toString(),
                  ownerName: customerName,
                  isOnlinePayment: isOnline,
                });

                await this.brevoService.sendEmail({
                  to: customerEmail,
                  subject: `Order Created ✓ - ${order.orderNumber}`,
                  htmlContent: emailHtml,
                });

                await this.prisma.notification.create({
                  data: {
                    userId: order.customer?.user?.id || order.retailCustomer?.id || payload.customerUId,
                    title: 'Order Email: CREATE',
                    body: `Order creation email sent for ${order.orderNumber}`,
                    type: NotificationType.ORDER,
                    channel: NotificationChannel.EMAIL,
                    metadata: {
                      orderId: order.id,
                      orderNumber: order.orderNumber,
                    },
                  },
                });
              }
            }
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to send customer order created email: ${err.message}`,
          );
        }
      },
    );

    this.emitter.on(ORDER_ALLOCATION_EVENTS.PROPOSAL_SENT, async (payload) => {
      let recipientUsers = payload.franchiseUserIds ?? [];
      let fallbackEmail: string | null = null;

      if (recipientUsers.length === 0) {
        const franchise = await this.prisma.franchise.findUnique({
          where: { id: payload.franchiseId },
          select: { ownerEmail: true },
        });

        fallbackEmail = franchise?.ownerEmail ?? null;

        const fallbackUsers = await this.prisma.user.findMany({
          where: {
            isActive: true,
            role: {
              in: ['FRANCHISE_OWNER', 'FRANCHISE_STAFF'],
            },
            OR: [
              { franchiseId: payload.franchiseId },
              { franchiseOwnerId: payload.franchiseId },
              ...(franchise?.ownerEmail
                ? [{ email: franchise.ownerEmail.trim().toLowerCase() }]
                : []),
            ],
          },
          select: { id: true, email: true },
        });

        recipientUsers = fallbackUsers.map((user) => user.id);

        // for (const user of fallbackUsers) {
        //   if (user.email) {
        //     await this.brevoService.sendEmail({
        //       to: user.email,
        //       subject: 'New order proposal',
        //       htmlContent: `
        //         <div style="font-family: sans-serif;">
        //           <h2>New order proposal</h2>
        //           <p>Order request <strong>${payload.requestId}</strong> is available for acceptance.</p>
        //         </div>
        //       `,
        //     });
        //   }
        // }

        // if (recipientUsers.length === 0 && fallbackEmail) {
        //   await this.brevoService.sendEmail({
        //     to: fallbackEmail,
        //     subject: 'New order proposal',
        //     htmlContent: `
        //       <div style="font-family: sans-serif;">
        //         <h2>New order proposal</h2>
        //         <p>Order request <strong>${payload.requestId}</strong> is available for acceptance.</p>
        //       </div>
        //     `,
        //   });
        // }
      }

      // Also surface the proposal in the franchise-notices inbox so the
      // franchise UI can show it alongside other franchise notices.
      try {
        const createdByUserId = recipientUsers[0];

        if (createdByUserId) {
          await this.prisma.franchiseNotice.create({
            data: {
              title: 'New order proposal',
              body: `Order request ${payload.requestId} is available for acceptance.`,
              audience: 'SINGLE_FRANCHISE',
              franchiseId: payload.franchiseId,
              createdByUserId,
            },
          });
        }
      } catch {
        // Best-effort only. Generic notifications above still run.
      }

      const durationMinutes = Math.max(
        1,
        Math.round(
          (new Date(payload.expiresAt).getTime() - Date.now()) / 60000,
        ),
      );

      for (const userId of recipientUsers) {
        this.logger.log(
          `[ProposalNotify] sent request=${payload.requestId} proposal=${payload.proposalId} franchise=${payload.franchiseId} user=${userId}`,
        );

        const notification = await this.prisma.notification.create({
          data: {
            userId,
            title: 'New order proposal',
            body: `Order request ${payload.requestId} is available for acceptance. You have ${durationMinutes} minutes to accept or reject this request.`,
            type: NotificationType.SYSTEM,
            channel: NotificationChannel.IN_APP,
            metadata: payload as any,
          },
        });

        await this.websocketService.send(userId, {
          event: ORDER_ALLOCATION_EVENTS.PROPOSAL_SENT,
          payload,
          ...notification,
        });
      }
    });

    this.emitter.on(
      ORDER_ALLOCATION_EVENTS.PROPOSAL_ACCEPTED,
      async (payload) => {
        let dbNotification;
        try {
          const bodyText = payload.orderNumber
            ? `Your order #${payload.orderNumber} has been accepted and is being prepared.`
            : `Your order request ${payload.requestId} has been accepted.`;

          dbNotification = await this.prisma.notification.create({
            data: {
              userId: payload.customerUId,
              title: 'Order accepted',
              body: bodyText,
              type: NotificationType.SYSTEM,
              channel: NotificationChannel.IN_APP,
              metadata: payload as any,
            },
          });
        } catch (err: any) {
          this.logger.error(
            `Failed to create database notification for accepted proposal: ${err.message}`,
          );
        }

        await this.websocketService.send(payload.customerUId, {
          event: ORDER_ALLOCATION_EVENTS.PROPOSAL_ACCEPTED,
          payload,
          ...(dbNotification ? dbNotification : {}),
        });

        // Update the accepting franchise user's notifications to mark as accepted
        try {
          await this.prisma.notification.updateMany({
            where: {
              metadata: {
                path: ['proposalId'],
                equals: payload.proposalId,
              },
              userId: { not: payload.customerUId },
            },
            data: {
              title: 'Order proposal accepted',
              body: `You accepted order request ${payload.requestId}.`,
              isRead: true,
              readAt: new Date(),
            },
          });
        } catch (err: any) {
          this.logger.error(
            `Failed to update accepting franchise notification: ${err.message}`,
          );
        }

        // Cancel/update other franchises' notifications for the same request
        try {
          await this.prisma.notification.updateMany({
            where: {
              metadata: {
                path: ['requestId'],
                equals: payload.requestId,
              },
              NOT: {
                metadata: {
                  path: ['proposalId'],
                  equals: payload.proposalId,
                },
              },
              userId: { not: payload.customerUId },
            },
            data: {
              title: 'Order proposal cancelled',
              body: `Order request ${payload.requestId} was accepted by another franchise.`,
              isRead: true,
              readAt: new Date(),
            },
          });
        } catch (err: any) {
          this.logger.error(
            `Failed to cancel other franchise notifications: ${err.message}`,
          );
        }

        // Send transactional email to customer (best-effort)
        try {
          const order = await this.prisma.order.findUnique({
            where: { id: payload.orderId },
            include: {
              customer: { select: { name: true, user: { select: { email: true, id: true } } } },
              retailCustomer: true,
            },
          });

          if (order) {
            const customerEmail = order.customer?.user?.email || order.retailCustomer?.email;
            if (customerEmail) {
              // Send the invoice email (with PDF attachment) for both COD and Online Payment orders after acceptance
              await this.sendInvoiceEmail(order.id);
            }
          }
        } catch (e: any) {
          this.logger.error(
            `Failed to send customer order accepted email: ${e.message}`,
          );
        }
      },
    );

    this.emitter.on(
      ORDER_ALLOCATION_EVENTS.PROPOSAL_REJECTED,
      async (payload) => {
        await this.websocketService.send(payload.customerUId, {
          event: ORDER_ALLOCATION_EVENTS.PROPOSAL_REJECTED,
          payload,
        });

        // Update proposal notifications to marked as read/rejected
        try {
          await this.prisma.notification.updateMany({
            where: {
              metadata: {
                path: ['proposalId'],
                equals: payload.proposalId,
              },
              userId: { not: payload.customerUId },
            },
            data: {
              title: 'Order proposal rejected',
              body: `You rejected order request ${payload.requestId}.`,
              isRead: true,
              readAt: new Date(),
            },
          });
        } catch (err: any) {
          this.logger.error(
            `Failed to update rejected proposal notifications: ${err.message}`,
          );
        }
      },
    );

    this.emitter.on(
      ORDER_ALLOCATION_EVENTS.PROPOSAL_EXPIRED,
      async (payload) => {
        this.logger.warn(
          `[ProposalExpire] expired request=${payload.requestId} proposal=${payload.proposalId} franchise=${payload.franchiseId} customer=${payload.customerId}`,
        );

        /*
        const notification = await this.prisma.notification.create({
          data: {
            userId: payload.customerUId,
            title: 'Searching next franchise',
            body: 'The nearest franchise did not respond in time. We are now trying the next closest franchise.',
            type: NotificationType.SYSTEM,
            channel: NotificationChannel.IN_APP,
            metadata: payload as any,
          },
        });
        */

        await this.websocketService.send(payload.customerUId, {
          event: ORDER_ALLOCATION_EVENTS.PROPOSAL_EXPIRED,
          payload,
        });

        this.logger.log(
          `[ProposalExpire] notified customer=${payload.customerId} that request=${payload.requestId} moved to next franchise`,
        );

        // Update proposal notifications to marked as read/expired
        try {
          await this.prisma.notification.updateMany({
            where: {
              metadata: {
                path: ['proposalId'],
                equals: payload.proposalId,
              },
              userId: { not: payload.customerUId },
            },
            data: {
              title: 'Order proposal expired',
              body: `Order request ${payload.requestId} proposal expired due to inactivity.`,
              isRead: true,
              readAt: new Date(),
            },
          });
        } catch (err: any) {
          this.logger.error(
            `Failed to update expired proposal notifications: ${err.message}`,
          );
        }

        /*
        try {
          const customer = await this.prisma.user.findUnique({
            where: { id: payload.customerUId },
            select: { email: true },
          });

          if (customer?.email) {
            const template = NearestSearchingTemplate.build({
              requestId: payload.requestId,
              note: 'The nearest franchise did not respond within the required time. We are now contacting the next closest available franchise and will notify you as soon as your order request is accepted.',
            });

            await this.brevoService.sendEmail({
              to: customer.email,
              subject: 'We are searching the next franchise',
              htmlContent: template,
            });
          }
        } catch {
          // Best-effort only. The in-app notification and websocket were already sent.
        }
        */
      },
    );

    this.emitter.on(ORDER_ALLOCATION_EVENTS.ORDER_CREATED, async (payload) => {
      // 1. Notify Customer (Only for fallback cases to prevent duplicate alerts)
      const isFallback =
        payload.isForcefullyAssigned === true ||
        payload.franchiseId === 'WAREHOUSE';

      let dbNotification;
      if (isFallback) {
        try {
          dbNotification = await this.prisma.notification.create({
            data: {
              userId: payload.customerUId,
              title: 'Order created',
              body: `Order ${payload.orderNumber} has been created and assigned.`,
              type: NotificationType.SYSTEM,
              channel: NotificationChannel.IN_APP,
              metadata: payload as any,
            },
          });
        } catch (err: any) {
          this.logger.error(
            `Failed to create customer order created DB notification: ${err.message}`,
          );
        }

        try {
          const order = await this.prisma.order.findUnique({
            where: { id: payload.orderId },
            include: {
              customer: { select: { name: true, user: { select: { email: true, id: true } } } },
              retailCustomer: true,
            },
          });

          if (order) {
            const customerEmail = order.customer?.user?.email || order.retailCustomer?.email;
            if (customerEmail) {
              // Send the invoice email (with PDF attachment) for both COD and Online Payment orders after fallback/force-assignment
              await this.sendInvoiceEmail(order.id);
            }
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to send customer order created fallback email: ${err.message}`,
          );
        }
      }

      await this.websocketService.send(payload.customerUId, {
        event: ORDER_ALLOCATION_EVENTS.ORDER_CREATED,
        payload,
        ...(dbNotification ? dbNotification : {}),
      });

      // 2. Notify Admins (SUPERADMIN)
      try {
        const admins = await this.prisma.user.findMany({
          where: {
            role: {
              in: [Role.SUPERADMIN],
            },
            isActive: true,
          },
          select: { id: true, email: true },
        });

        const isWarehouse = payload.franchiseId === 'WAREHOUSE';
        let adminTitle = isWarehouse
          ? 'Action Required: Fallback Order Created'
          : 'New order created';
        let adminBody = isWarehouse
          ? `Order ${payload.orderNumber} was not accepted by any franchise and has been forcefully assigned to the Central Warehouse. Please review and arrange fulfillment.`
          : `Order ${payload.orderNumber} has been created and assigned to franchise ${payload.franchiseId}.`;

        if (payload.isForcefullyAssigned === true) {
          adminTitle = `🚨 [FORCE ASSIGNED] ${adminTitle}`;
          adminBody = `🚨 FORCE ASSIGNED ORDER: ${adminBody}`;
        }

        for (const admin of admins) {
          const notification = await this.prisma.notification.create({
            data: {
              userId: admin.id,
              title: adminTitle,
              body: adminBody,
              type: NotificationType.SYSTEM,
              channel: NotificationChannel.IN_APP,
              metadata: payload as any,
            },
          });
          await this.websocketService.send(admin.id, {
            event: ORDER_ALLOCATION_EVENTS.ORDER_CREATED,
            payload,
            ...notification,
          });

          // Need to notify via email (ADMIN).
          // if (admin.email) {
          //   await this.brevoService.sendEmail({
          //     to: admin.email,
          //     subject: `${isWarehouse ? '⚠ Fallback ' : ''}New order created - ${payload.orderNumber}`,
          //     htmlContent: `
          //       <div style="font-family: sans-serif;">
          //         <h2>${adminTitle}</h2>
          //         <p>${adminBody}</p>
          //         <p>Total amount: ₹${payload.totalAmount}</p>
          //       </div>
          //     `,
          //   });
          // }
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to notify admins about order creation: ${err.message}`,
        );
      }

      // 3. Notify Franchise Users
      if (payload.franchiseId && payload.franchiseId !== 'WAREHOUSE') {
        try {
          const franchiseUsers = await this.prisma.user.findMany({
            where: {
              franchiseId: payload.franchiseId,
              isActive: true,
              role: { in: [Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF] },
            },
            select: { id: true, email: true },
          });

          for (const user of franchiseUsers) {
            let franchiseTitle = 'New order assigned';
            let franchiseBody = `Order ${payload.orderNumber} has been created and assigned to your franchise.`;

            if (payload.isForcefullyAssigned === true) {
              franchiseTitle = `🚨 [FORCE ASSIGNED] ${franchiseTitle}`;
              franchiseBody = `🚨 FORCE ASSIGNED ORDER: ${franchiseBody}`;
            }

            const notification = await this.prisma.notification.create({
              data: {
                userId: user.id,
                title: franchiseTitle,
                body: franchiseBody,
                type: NotificationType.SYSTEM,
                channel: NotificationChannel.IN_APP,
                metadata: payload as any,
              },
            });
            await this.websocketService.send(user.id, {
              event: ORDER_ALLOCATION_EVENTS.ORDER_CREATED,
              payload,
              ...notification,
            });

            // Need to notify via email (FRANCHISE_OWNER, FRANCHISE_STAFF).
            // if (user.email) {
            //   await this.brevoService.sendEmail({
            //     to: user.email,
            //     subject: `New order assigned - ${payload.orderNumber}`,
            //     htmlContent: `
            //       <div style="font-family: sans-serif;">
            //         <h2>New order assigned</h2>
            //         <p>Order <strong>${payload.orderNumber}</strong> has been created and assigned to your franchise.</p>
            //         <p>Total amount: ₹${payload.totalAmount}</p>
            //         <p>Please log in to manage and fulfill the order.</p>
            //       </div>
            //     `,
            //   });
            // }
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to notify franchise about order assignment: ${err.message}`,
          );
        }
      }
    });

    this.emitter.on(
      ORDER_ALLOCATION_EVENTS.ORDER_ALLOCATION_FAILED,
      async (payload) => {
        if (payload.customerUId) {
          try {
            await this.prisma.notification.create({
              data: {
                userId: payload.customerUId,
                title: 'Order Cancelled - Out of Stock',
                body: payload.reason,
                type: NotificationType.SYSTEM,
                channel: NotificationChannel.IN_APP,
                metadata: payload as any,
              },
            });
          } catch (err: any) {
            this.logger.error(
              `Failed to create database notification for customer: ${err.message}`,
            );
          }

          try {
            const user = await this.prisma.user.findUnique({
              where: { id: payload.customerUId },
              select: { email: true },
            });
            if (user?.email) {
              await this.brevoService.sendEmail({
                to: user.email,
                subject: 'Order Cancelled - Out of Stock',
                htmlContent: `
                  <div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
                    <h2>Order Cancellation Notice</h2>
                    <p>${payload.reason}</p>
                  </div>
                `,
              });
            }
          } catch (emailErr: any) {
            this.logger.error(
              `Failed to send out of stock email to customer: ${emailErr.message}`,
            );
          }
        }

        await this.websocketService.send(payload.customerUId, {
          event: ORDER_ALLOCATION_EVENTS.ORDER_ALLOCATION_FAILED,
          payload,
        });

        // Notify active SUPERADMIN users
        try {
          const admins = await this.prisma.user.findMany({
            where: {
              role: {
                in: [Role.SUPERADMIN],
              },
              isActive: true,
            },
            select: { id: true },
          });

          this.logger.log(
            `Notifying ${admins.length} admins about allocation failure of request ${payload.requestId}`,
          );

          for (const admin of admins) {
            const notification = await this.prisma.notification.create({
              data: {
                userId: admin.id,
                title: 'Order Allocation Failed',
                body: `Order request ${payload.requestId} was rejected or ignored by every franchise and could not be allocated.`,
                type: NotificationType.SYSTEM,
                channel: NotificationChannel.IN_APP,
                metadata: payload as any,
              },
            });
            await this.websocketService.send(admin.id, {
              event: ORDER_ALLOCATION_EVENTS.ORDER_ALLOCATION_FAILED,
              payload,
              ...notification,
            });
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to notify admins about order allocation failure: ${err.message}`,
          );
        }
      },
    );
  }
}
