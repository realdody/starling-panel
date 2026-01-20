import http from '@/api/http';

export default async (uuid: string, roleIds: number[]): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/roles`, { roles: roleIds });
};
