<?php

namespace Pterodactyl\Services\Servers;

use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;

class GetUserPermissionsService
{
    /**
     * Returns the server specific permissions that a user has. This checks
     * if they are an admin or a subuser for the server. If no permissions are
     * found, an empty array is returned.
     */
    public function handle(Server $server, User $user): array
    {
        if ($user->root_admin || $user->id === $server->owner_id) {
            $permissions = ['*'];

            if ($user->root_admin) {
                $permissions[] = 'admin.websocket.errors';
                $permissions[] = 'admin.websocket.install';
                $permissions[] = 'admin.websocket.transfer';
            }

            return $permissions;
        }
        // Find roles that user has AND server uses
        $matchingRoles = $user->roles()
            ->whereIn('roles.id', $server->roles()->pluck('roles.id'))
            ->get();

        if ($matchingRoles->isNotEmpty()) {
            // Merge permissions from all matching roles
            return $matchingRoles
                ->pluck('permissions')
                ->flatten()
                ->unique()
                ->values()
                ->all();
        }

        // Fall back to legacy subuser permissions if no matching roles
        /** @var \Pterodactyl\Models\Subuser|null $subuserPermissions */
        $subuserPermissions = $server->subusers()->where('user_id', $user->id)->first();

        return $subuserPermissions ? $subuserPermissions->permissions : [];
    }
}
