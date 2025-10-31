import http from '@/api/http';
import { BackupCategory } from '@/api/server/types';
import { rawDataToBackupCategory } from '@/api/transformers';

interface Payload {
    name?: string;
    maxBackups?: number;
}

export default async (uuid: string, categoryId: number, payload: Payload): Promise<BackupCategory> => {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) {
        body.name = payload.name;
    }
    if (payload.maxBackups !== undefined) {
        body.max_backups = payload.maxBackups;
    }

    const { data } = await http.post(`/api/client/servers/${uuid}/backup-categories/${categoryId}`, body);

    return rawDataToBackupCategory(data);
};
