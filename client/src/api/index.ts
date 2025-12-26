/**
 * REST API 클라이언트
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 공통 fetch 래퍼
async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || 'Request failed');
    }
    return res.json();
}

// Pipe 관련 API
export const pipesApi = {
    list: () => request<any[]>('/api/pipes'),
    get: (id: string) => request<any>(`/api/pipes/${id}`),
    create: (data: any) => request<any>('/api/pipes', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id: string, data: any) => request<any>(`/api/pipes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id: string) => fetch(`${API_BASE}/api/pipes/${id}`, { method: 'DELETE' }),
};

// Execution 관련 API
export const executionApi = {
    execute: (pipeId: string, sourcePath?: string) => request<any>('/api/execution', {
        method: 'POST',
        body: JSON.stringify({ pipeId, sourcePath }),
    }),
    getStatus: () => request<any>('/api/execution/status'),
    cancel: () => fetch(`${API_BASE}/api/execution`, { method: 'DELETE' }),
};

// 스토리지 API (MinIO)
export interface StorageItem {
    name: string;
    path: string;
    type: 'file' | 'folder';
    size?: number;
    lastModified?: string;
}

export const storageApi = {
    // 경로 내용 조회
    list: (path: string = '/'): Promise<{ path: string; items: StorageItem[] }> =>
        request(`/api/storage?path=${encodeURIComponent(path)}`),

    // 폴더 생성
    createFolder: (path: string) => request<{ success: boolean }>('/api/storage/folder', {
        method: 'POST',
        body: JSON.stringify({ path }),
    }),

    // 파일 업로드
    upload: async (path: string, files: File[]): Promise<{ success: boolean; files: string[] }> => {
        const formData = new FormData();
        formData.append('path', path);
        files.forEach(file => formData.append('files', file));

        const res = await fetch(`${API_BASE}/api/storage/upload`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
    },

    // 삭제
    delete: (path: string, type: 'file' | 'folder') => request<{ success: boolean }>('/api/storage', {
        method: 'DELETE',
        body: JSON.stringify({ path, type }),
    }),

    // 다운로드 URL
    getDownloadUrl: (path: string) => `${API_BASE}/api/storage/download?path=${encodeURIComponent(path)}`,
};
