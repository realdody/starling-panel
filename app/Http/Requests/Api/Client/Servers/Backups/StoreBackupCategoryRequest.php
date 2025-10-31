<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Backups;

use Illuminate\Validation\Rule;
use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Models\Server;

class StoreBackupCategoryRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_BACKUP_CREATE;
    }

    public function rules(): array
    {
        /** @var Server $server */
        $server = $this->route()->parameter('server');

        return [
            'name' => [
                'required',
                'string',
                'max:191',
                Rule::unique('backup_categories', 'name')->where(fn ($query) => $query->where('server_id', $server->id)),
            ],
            'max_backups' => 'required|integer|min:1',
        ];
    }
}
