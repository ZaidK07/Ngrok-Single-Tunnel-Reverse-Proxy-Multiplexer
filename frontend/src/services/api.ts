import axios from 'axios';
import {
  NodeEntity,
  RequestLog,
  NgrokStatus,
  SystemInfo,
  TrafficStats,
  CreateNodePayload,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const getNgrokStatus = async (): Promise<NgrokStatus> => {
  const res = await api.get('/ngrok/status');
  return res.data.data;
};

export const startNgrok = async (): Promise<NgrokStatus> => {
  const res = await api.post('/ngrok/start');
  return res.data.data;
};

export const stopNgrok = async (): Promise<NgrokStatus> => {
  const res = await api.post('/ngrok/stop');
  return res.data.data;
};

export const getNodes = async (): Promise<NodeEntity[]> => {
  const res = await api.get('/nodes');
  return res.data.data;
};

export const getNode = async (id: string): Promise<NodeEntity> => {
  const res = await api.get(`/nodes/${id}`);
  return res.data.data;
};

export const createNode = async (data: CreateNodePayload): Promise<NodeEntity> => {
  const res = await api.post('/nodes', data);
  return res.data.data;
};

export const updateNode = async (
  id: string,
  data: Partial<CreateNodePayload & { is_active: boolean }>,
): Promise<NodeEntity> => {
  const res = await api.patch(`/nodes/${id}`, data);
  return res.data.data;
};

export const deleteNode = async (id: string): Promise<{ success: boolean; message: string }> => {
  const res = await api.delete(`/nodes/${id}`);
  return res.data;
};

export const pingNode = async (id: string) => {
  const res = await api.post(`/nodes/${id}/ping`);
  return res.data.data;
};

export const activateNode = async (id: string) => {
  const res = await api.post(`/nodes/${id}/activate`);
  return res.data;
};

export const getNodeLogs = async (
  id: string,
  params?: { page?: number; limit?: number; search?: string; status?: string },
) => {
  const res = await api.get(`/nodes/${id}/logs`, { params });
  return res.data.data;
};

export const getTrafficLogs = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  nodeId?: string;
  status?: string;
  method?: string;
}) => {
  const res = await api.get('/traffic', { params });
  return res.data.data;
};

export const getTrafficStats = async (): Promise<TrafficStats> => {
  const res = await api.get('/traffic/stats');
  return res.data.data;
};

export const getTrafficStatuses = async (nodeId?: string): Promise<number[]> => {
  const params = nodeId ? { nodeId } : undefined;
  const res = await api.get('/traffic/statuses', { params });
  return res.data.data;
};

export const getTrafficMethods = async (nodeId?: string): Promise<string[]> => {
  const params = nodeId ? { nodeId } : undefined;
  const res = await api.get('/traffic/methods', { params });
  return res.data.data;
};

export const clearTrafficLogs = async (days?: number) => {
  const res = await api.delete('/traffic/clear', { params: { days } });
  return res.data;
};

export const getSystemInfo = async (): Promise<SystemInfo> => {
  const res = await api.get('/settings/info');
  return res.data.data;
};

export const getConfigSettings = async () => {
  const res = await api.get('/settings/config');
  return res.data.data;
};

export const updateConfigSettings = async (payload: {
  ngrok_authtoken?: string;
  ngrok_domain?: string;
  gateway_port?: string | number;
  traffic_refresh_interval?: string | number;
  traffic_auto_refresh?: boolean;
  theme?: string;
}) => {
  const res = await api.post('/settings/config', payload);
  return res.data;
};

export interface SetupStatus {
  isConfigured: boolean;
  hasAuthToken: boolean;
  configuredDomain: string | null;
  gatewayPort: number;
  dbStatus: any;
  ngrokStatus: NgrokStatus;
}

export const getSetupStatus = async (): Promise<SetupStatus> => {
  const res = await api.get('/setup/status');
  return res.data.data;
};

export const configureGateway = async (payload: {
  authtoken: string;
  domain?: string;
  gatewayPort?: number;
}): Promise<NgrokStatus> => {
  const res = await api.post('/setup/configure', payload);
  return res.data.data;
};

export default api;
