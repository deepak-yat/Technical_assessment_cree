import { apiClient, setAccessToken } from './client.js';
import { ApiResponse, AuthResponseData, UserDto } from '../types/api.js';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authApi = {
  async register(input: RegisterInput): Promise<AuthResponseData> {
    const res = await apiClient.post<ApiResponse<AuthResponseData>>('/auth/register', input);
    setAccessToken(res.data.data.accessToken);
    return res.data.data;
  },

  async login(input: LoginInput): Promise<AuthResponseData> {
    const res = await apiClient.post<ApiResponse<AuthResponseData>>('/auth/login', input);
    setAccessToken(res.data.data.accessToken);
    return res.data.data;
  },

  async refresh(): Promise<string> {
    const res = await apiClient.post<ApiResponse<{ accessToken: string }>>('/auth/refresh');
    const token = res.data.data.accessToken;
    setAccessToken(token);
    return token;
  },

  async getMe(): Promise<UserDto> {
    const res = await apiClient.get<ApiResponse<{ user: UserDto }>>('/auth/me');
    return res.data.data.user;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post<ApiResponse<{ message: string }>>('/auth/logout');
    } finally {
      setAccessToken(null);
    }
  },
};
