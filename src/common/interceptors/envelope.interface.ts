export type IMeta = {
  source?: string;
  count: number;
  totalPages?: number;
  page?: number;
  limit?: number;
  summary?: Record<string, unknown>;
};

export interface ISuccessResponse<TData = unknown, TMeta = IMeta> {
  status?: number;
  success?: boolean;
  message?: string;
  data?: TData;
  meta?: TMeta;
  accessToken?: string;
  refreshToken?: string;
  timestamp?: string;
  source?: string;
}

export interface Response<T> {
  status?: number; // HTTP status code
  message?: string; // Message from the server
  data?: T;
  accessToken?: string;
  refreshToken?: string;
  source?: string; // The actual data returned by the controller
  count?: number; // Option
}

// export interface SuccessResponse<T> extends Response<T> {}
