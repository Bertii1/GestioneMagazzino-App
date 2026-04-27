import api from './api';
import { ActivityLogResponse } from '../types';

export const activityService = {
  async getLogs(page = 1, limit = 50): Promise<ActivityLogResponse> {
    const { data } = await api.get<ActivityLogResponse>('/activity', {
      params: { page, limit },
    });
    return data;
  },
};
