import useSWR from 'swr';
import http from '@/api/http';
import { BackupCategory } from '@/api/server/types';
import { rawDataToBackupCategory } from '@/api/transformers';
import { ServerContext } from '@/state/server';

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    return useSWR<BackupCategory[]>(['server:backup-categories', uuid], async () => {
        const { data } = await http.get(`/api/client/servers/${uuid}/backup-categories`);

        return (data.data || []).map(rawDataToBackupCategory);
    });
};
