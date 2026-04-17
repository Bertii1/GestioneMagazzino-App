import api from "./api";
import { Shelf, CreateShelfDto } from "../types";

export const shelfService = {
  async getByWarehouse(warehouseId: string): Promise<Shelf[]> {
    const { data } = await api.get<Shelf[]>(
      `/warehouses/${warehouseId}/shelves`,
    );
    return data;
  },

  async getById(id: string): Promise<Shelf> {
    const { data } = await api.get<Shelf>(`/shelves/${id}`);
    return data;
  },

  async create(warehouseId: string, dto: CreateShelfDto): Promise<Shelf> {
    const { data } = await api.post<Shelf>(
      `/warehouses/${warehouseId}/shelves`,
      dto,
    );
    return data;
  },

  async update(id: string, dto: Partial<CreateShelfDto>): Promise<Shelf> {
    const { data } = await api.put<Shelf>(`/shelves/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/shelves/${id}`);
  },
};
