import http from '@/api/http';

export interface Role {
    id: number;
    name: string;
    description: string | null;
    permissions_count: number;
    assigned: boolean;
}

export default async (uuid: string): Promise<Role[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/roles`);
    return data.roles || [];
};
