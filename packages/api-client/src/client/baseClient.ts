import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { RequestOptions } from '../types/common';
import { ApiError, getApiErrorMessage } from './error';

export type TokenProvider = () => string | null | Promise<string | null>;
export type OnUnauthorizedHandler = (error: AxiosError) => void | Promise<void>;

export interface ClientConfig {
  baseURL: string;
  timeout?: number;
  getToken?: TokenProvider;
  onUnauthorized?: OnUnauthorizedHandler;
  headers?: Record<string, string>;
}

export class BaseClient {
  public readonly api: AxiosInstance;
  private getToken?: TokenProvider;
  private onUnauthorized?: OnUnauthorizedHandler;

  constructor(config: ClientConfig) {
    this.getToken = config.getToken;
    this.onUnauthorized = config.onUnauthorized;

    this.api = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    // Request interceptor: attach token
    this.api.interceptors.request.use(
      async (reqConfig: InternalAxiosRequestConfig) => {
        if (this.getToken) {
          const token = await this.getToken();
          if (token) {
            reqConfig.headers.Authorization = `Bearer ${token}`;
          }
        }

        // Ngrok free-tier skip warning header for mobile dev tunneling
        const base = reqConfig.baseURL ?? this.api.defaults.baseURL ?? '';
        if (typeof base === 'string' && base.includes('ngrok')) {
          reqConfig.headers['ngrok-skip-browser-warning'] = 'true';
        }

        return reqConfig;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: handle 401 and wrap errors
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401 && this.onUnauthorized) {
          await this.onUnauthorized(error);
        }
        const message = getApiErrorMessage(error);
        const data = error.response?.data;
        return Promise.reject(new ApiError(message, error.response?.status, error.code, data));
      }
    );
  }

  public setTokenProvider(provider: TokenProvider): void {
    this.getToken = provider;
  }

  public setUnauthorizedHandler(handler: OnUnauthorizedHandler): void {
    this.onUnauthorized = handler;
  }

  public async get<T>(url: string, options?: RequestOptions): Promise<T> {
    const response = await this.api.get<T>(url, {
      params: options?.params,
      headers: options?.headers,
      signal: options?.signal,
    });
    return response.data;
  }

  public async post<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.api.post<T>(url, data, {
      params: options?.params,
      headers: options?.headers,
      signal: options?.signal,
    });
    return response.data;
  }

  public async put<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.api.put<T>(url, data, {
      params: options?.params,
      headers: options?.headers,
      signal: options?.signal,
    });
    return response.data;
  }

  public async patch<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.api.patch<T>(url, data, {
      params: options?.params,
      headers: options?.headers,
      signal: options?.signal,
    });
    return response.data;
  }

  public async delete<T>(url: string, options?: RequestOptions): Promise<T> {
    const response = await this.api.delete<T>(url, {
      params: options?.params,
      headers: options?.headers,
      signal: options?.signal,
    });
    return response.data;
  }
}
