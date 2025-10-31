<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Backups;

use Illuminate\Validation\Rule;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Models\BackupCategory;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Server;

class UpdateBackupCategoryRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_BACKUP_CREATE;
    }

    public function rules(): array
    {
        /** @var Server $server */
        $server = $this->route()->parameter('server');
        /** @var BackupCategory $category */
        $category = $this->route()->parameter('category');

        return [
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:191',
                Rule::unique('backup_categories', 'name')
                    ->where(fn ($query) => $query->where('server_id', $server->id))
                    ->ignore($category->id),
            ],
            'max_backups' => 'sometimes|required|integer|min:1',
        ];
    }
}
