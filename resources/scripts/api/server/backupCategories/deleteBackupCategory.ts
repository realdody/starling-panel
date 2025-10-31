import http from '@/api/http';

export default async (uuid: string, categoryId: number): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/backup-categories/${categoryId}`);
};
