import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Prisma Errors
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let errors: any = null;

    /* -------------------- 1. NESTJS (DTO / HTTP) -------------------- */
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response: any = exception.getResponse();

      if (typeof response === 'object') {
        message = response.message || message;

        // 🔥 HANDLE DTO ARRAY ERRORS PROPERLY
        if (Array.isArray(response.message)) {
          errors = response.message;
          message = 'Validation failed';
        } else {
          errors = response.errors || null;
        }
      } else {
        message = response;
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      /* -------------------- 2. PRISMA -------------------- */
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;

          const fields = exception.meta?.target as string[];
          message = `${fields?.join(', ')} already exists`;
          break;

        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;

        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Invalid relation / foreign key';
          break;

        default:
          status = HttpStatus.BAD_REQUEST;
          message = exception.message;
      }
    } else if (exception instanceof PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
    } else if (exception instanceof Error) {
      /* -------------------- 3. FALLBACK -------------------- */
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
    }

    // Only log severe system errors (5xx) as full errors with stack trace
    if (status >= 500) {
      this.logger.error(
        `Error at ${req.method} ${req.url}`,
        (exception as any)?.stack || exception,
      );
    } else {
      // Log client errors as warnings without stack traces to prevent log pollution
      this.logger.warn(
        `Client error (${status}) at ${req.method} ${req.url}: ${message}`,
      );
    }

    /* -------------------- RESPONSE -------------------- */
    res.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}

/*
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const m = (res as { message?: string | string[] }).message;
        message = Array.isArray(m) ? m.join(', ') : (m ?? message);
      }
      code = status === HttpStatus.UNAUTHORIZED ? 'UNAUTHORIZED' : 'HTTP_ERROR';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      data: null,
      meta: {},
      error: { message, code },
    });
  }
}
*/
