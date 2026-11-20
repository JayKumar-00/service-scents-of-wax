import { Injectable, HttpStatus, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class SurepassProvider {
  private client: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const baseUrl = this.config.get<string>(
      'SUREPASS_BASE_URL',
      'https://sandbox.surepass.io',
    );

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async postRequest(endpoint: string, data: any): Promise<any> {
    let apiToken = this.config.get<string>('SUREPASS_API_TOKEN', '');
    if (!apiToken) {
      apiToken = this.config.get<string>('SUREPASS_API_KEY', '');
    }
    if (!apiToken) {
      apiToken = this.config.get<string>('SUREPASS_TOKEN', '');
    }

    if (apiToken && apiToken.startsWith('"') && apiToken.endsWith('"')) {
      apiToken = apiToken.slice(1, -1);
    }

    const headers = {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await this.client.post(endpoint, data, { headers });
      return response.data;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  private handleAxiosError(error: any): never {
    console.error('[Surepass Axios Error Details]:', {
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      requestData: error.config?.data,
      status: error.response?.status,
      responseData: error.response?.data,
    });
    if (error.response) {
      const rawStatus = error.response.status;
      const status =
        typeof rawStatus === 'number' && rawStatus >= 100 && rawStatus < 600
          ? rawStatus
          : HttpStatus.BAD_GATEWAY;
      throw new HttpException(error.response.data, status);
    }
    throw new HttpException(
      {
        success: false,
        message: error.message || 'Surepass provider connection error',
        status_code: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async panVerification(idNumber: string): Promise<any> {
    return this.postRequest('/api/v1/pan/pan-only', { id_number: idNumber });
  }

  async aadhaarValidation(idNumber: string): Promise<any> {
    return this.postRequest('/api/v1/aadhaar-validation/aadhaar-validation', {
      id_number: idNumber,
    });
  }

  async generateOtp(idNumber: string): Promise<any> {
    return this.postRequest('/api/v1/aadhaar-v2/generate-otp', {
      id_number: idNumber,
    });
  }

  async submitOtp(clientId: string, otp: string): Promise<any> {
    return this.postRequest('/api/v1/aadhaar-v2/submit-otp', {
      client_id: clientId,
      otp,
    });
  }

  async bankVerification(
    idNumber: string,
    ifsc: string,
    ifscDetails: boolean,
  ): Promise<any> {
    return this.postRequest('/api/v1/bank-verification/', {
      id_number: idNumber,
      ifsc,
      ifsc_details: ifscDetails,
    });
  }

  async upiVerification(upiId: string): Promise<any> {
    return this.postRequest('/api/v1/bank-verification/upi-verification', {
      upi_id: upiId,
    });
  }

  async voterIdVerification(idNumber: string): Promise<any> {
    return this.postRequest('/api/v1/voter-id/voter-id', {
      id_number: idNumber,
    });
  }

  async drivingLicenseVerification(
    idNumber: string,
    dob: string,
  ): Promise<any> {
    return this.postRequest('/api/v1/driving-license/driving-license', {
      id_number: idNumber,
      dob,
    });
  }

  async passportVerification(clientId: string): Promise<any> {
    return this.postRequest('/api/v1/passport/passport/verify', {
      client_id: clientId,
    });
  }

  async gstinVerification(idNumber: string): Promise<any> {
    return this.postRequest('/api/v1/corporate/gstin', {
      id_number: idNumber,
    });
  }

  async gstAdvanceVerification(idNumber: string): Promise<any> {
    return this.postRequest('/api/v1/corporate/gstin-advanced', {
      id_number: idNumber,
    });
  }

  async irnVerification(
    fileBuffer: Buffer,
    fileName: string,
    fileMime: string,
    usePdf: string,
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([fileBuffer as any], { type: fileMime }),
        fileName,
      );
      formData.append('use_pdf', usePdf);

      let apiToken = this.config.get<string>('SUREPASS_API_TOKEN', '');
      if (!apiToken) {
        apiToken = this.config.get<string>('SUREPASS_API_KEY', '');
      }
      if (!apiToken) {
        apiToken = this.config.get<string>('SUREPASS_TOKEN', '');
      }

      if (apiToken && apiToken.startsWith('"') && apiToken.endsWith('"')) {
        apiToken = apiToken.slice(1, -1);
      }

      const response = await this.client.post(
        '/api/v1/corporate/einvoice-irn',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async faceMatch(
    selfieBuffer: Buffer,
    selfieName: string,
    selfieMime: string,
    idCardBuffer: Buffer,
    idCardName: string,
    idCardMime: string,
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append(
        'selfie',
        new Blob([selfieBuffer as any], { type: selfieMime }),
        selfieName,
      );
      formData.append(
        'id_card',
        new Blob([idCardBuffer as any], { type: idCardMime }),
        idCardName,
      );

      let apiToken = this.config.get<string>('SUREPASS_API_TOKEN', '');
      if (!apiToken) {
        apiToken = this.config.get<string>('SUREPASS_API_KEY', '');
      }
      if (!apiToken) {
        apiToken = this.config.get<string>('SUREPASS_TOKEN', '');
      }

      if (apiToken && apiToken.startsWith('"') && apiToken.endsWith('"')) {
        apiToken = apiToken.slice(1, -1);
      }

      const response = await this.client.post(
        '/api/v1/face/face-match',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }
}
