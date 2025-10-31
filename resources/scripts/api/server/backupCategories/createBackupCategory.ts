import http from '@/api/http';
import { BackupCategory } from '@/api/server/types';
import { rawDataToBackupCategory } from '@/api/transformers';

interface Payload {
    name: string;
    maxBackups: number;
}

export default async (uuid: string, payload: Payload): Promise<BackupCategory> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/backup-categories`, {
        name: payload.name,
        max_backups: payload.maxBackups,
    });

    return rawDataToBackupCategory(data);
};
