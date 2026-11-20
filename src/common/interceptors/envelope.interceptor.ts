import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isPlainHttpPath } from '../constants/observability';
import { addTotalCreditAmount } from '../utils/credit-serializer.util';

@Injectable()
export class EnvelopeInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();
    const request = httpContext.getRequest();

    if (isPlainHttpPath(request.url ?? request.path ?? '')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((result: any) => {
        const processedResult = addTotalCreditAmount(result);
        const method = request.method;

        return {
          statusCode: response.statusCode || HttpStatus.OK,
          status: response.statusCode || HttpStatus.OK,
          success: true,

          message:
            processedResult?.message ??
            (method === 'GET'
              ? 'Data fetched successfully'
              : ['PUT', 'PATCH'].includes(method)
                ? 'Record updated successfully'
                : method === 'DELETE'
                  ? 'Record deleted successfully'
                  : 'Operation completed successfully'),

          // ✅ Avoid wrapping message again inside data
          data:
            processedResult?.data ??
            (processedResult &&
            typeof processedResult === 'object' &&
            'message' in processedResult
              ? null
              : (processedResult ?? null)),

          meta: processedResult?.meta ?? null,

          accessToken: processedResult?.accessToken,
          refreshToken: processedResult?.refreshToken,

          ...(processedResult?.firebaseUid
            ? { firebaseUid: processedResult.firebaseUid }
            : {}),
          ...(processedResult?.firebaseIdToken
            ? { firebaseIdToken: processedResult.firebaseIdToken }
            : {}),
          ...(processedResult?.firebaseRefreshToken
            ? { firebaseRefreshToken: processedResult.firebaseRefreshToken }
            : {}),
          ...(processedResult?.name ? { name: processedResult.name } : {}),
          ...(processedResult?.avatar
            ? { avatar: processedResult.avatar }
            : {}),

          source: processedResult?.source ?? 'db',
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}

// export class EnvelopeInterceptor implements NestInterceptor {
//   intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
//     return next.handle().pipe(
//       map((data) => ({
//         data,
//         meta: {},
//       })),
//     );
//   }
// }
