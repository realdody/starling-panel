import http from '@/api/http';
import { ServerBackup } from '@/api/server/types';
import { rawDataToServerBackup } from '@/api/transformers';

interface RequestParameters {
    name?: string;
    ignored?: string;
    isLocked: boolean;
    backupCategoryId?: number | null;
}

export default async (uuid: string, params: RequestParameters): Promise<ServerBackup> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/backups`, {
        name: params.name,
        ignored: params.ignored,
        is_locked: params.isLocked,
        backup_category_id: params.backupCategoryId ?? null,
    });

    return rawDataToServerBackup(data);
};
