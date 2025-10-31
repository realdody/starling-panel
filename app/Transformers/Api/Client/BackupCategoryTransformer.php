<?php

namespace Pterodactyl\Transformers\Api\Client;

use Pterodactyl\Models\BackupCategory;

class BackupCategoryTransformer extends BaseClientTransformer
{
    public function getResourceName(): string
    {
        return 'backup_category';
    }

    public function transform(BackupCategory $category): array
    {
        return [
            'id' => $category->id,
            'server_id' => $category->server_id,
            'name' => $category->name,
            'max_backups' => $category->max_backups,
            'current_backup_count' => $category->current_backup_count ?? 0,
            'created_at' => $category->created_at->toAtomString(),
            'updated_at' => $category->updated_at->toAtomString(),
        ];
    }
}
