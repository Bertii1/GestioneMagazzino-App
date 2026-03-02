import api from './api';
import { Product, CreateProductDto, UpdateProductDto } from '../types';

export const productService = {
  async getAll(params?: { warehouseId?: string; shelfId?: string; q?: string }): Promise<Product[]> {
    const { data } = await api.get<Product[]>('/products', { params });
    return data;
  },

  async getById(id: string): Promise<Product> {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },

  async getByBarcode(barcode: string): Promise<Product> {
    const { data } = await api.get<Product>(`/products/barcode/${barcode}`);
    return data;
  },

  async create(dto: CreateProductDto): Promise<Product> {
    const { data } = await api.post<Product>('/products', dto);
    return data;
  },

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const { data } = await api.put<Product>(`/products/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },
};
