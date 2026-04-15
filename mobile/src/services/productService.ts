import api from './api';
import { Product, CreateProductDto, UpdateProductDto } from '../types';

export const productService = {
  async getBrands(): Promise<string[]> {
    const { data } = await api.get<string[]>('/products/brands');
    return data;
  },

  async getCategories(): Promise<string[]> {
    const { data } = await api.get<string[]>('/products/categories');
    return data;
  },

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

  async lookupCatalog(barcode: string): Promise<{
    barcode: string;
    name: string;
    description?: string;
    color?: string;
    brand?: string;
    category?: string;
  } | null> {
    try {
      const { data } = await api.get(`/products/catalog/${barcode}`);
      return data;
    } catch {
      return null;
    }
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

  async uploadPhoto(productId: string, uri: string): Promise<{ filename: string; photos: string[] }> {
    const ext = uri.split('.').pop() ?? 'jpg';
    const formData = new FormData();
    formData.append('photo', {
      uri,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      name: `photo.${ext}`,
    } as unknown as Blob);
    const { data } = await api.post<{ filename: string; photos: string[] }>(
      `/products/${productId}/photos`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30_000 },
    );
    return data;
  },

  async deletePhoto(productId: string, filename: string): Promise<{ photos: string[] }> {
    const { data } = await api.delete<{ photos: string[] }>(`/products/${productId}/photos/${filename}`);
    return data;
  },
};
