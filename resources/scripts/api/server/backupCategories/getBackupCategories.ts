import http from '@/api/http';
import { BackupCategory } from '@/api/server/types';
import { rawDataToBackupCategory } from '@/api/transformers';

export default async (uuid: string): Promise<BackupCategory[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/backup-categories`);

    return (data.data || []).map(rawDataToBackupCategory);
};
