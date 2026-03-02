import api from './api';
import { Warehouse, CreateWarehouseDto } from '../types';

export const warehouseService = {
  async getAll(): Promise<Warehouse[]> {
    const { data } = await api.get<Warehouse[]>('/warehouses');
    return data;
  },

  async getById(id: string): Promise<Warehouse> {
    const { data } = await api.get<Warehouse>(`/warehouses/${id}`);
    return data;
  },

  async create(dto: CreateWarehouseDto): Promise<Warehouse> {
    const { data } = await api.post<Warehouse>('/warehouses', dto);
    return data;
  },

  async update(id: string, dto: Partial<CreateWarehouseDto>): Promise<Warehouse> {
    const { data } = await api.put<Warehouse>(`/warehouses/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/warehouses/${id}`);
  },
};
