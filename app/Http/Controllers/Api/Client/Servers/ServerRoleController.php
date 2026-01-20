<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Pterodactyl\Models\Role;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class ServerRoleController extends ClientApiController
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Get all available roles and which ones are assigned to this server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        // Only server owner can manage roles
        if ($request->user()->id !== $server->owner_id && !$request->user()->root_admin) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $allRoles = Role::orderBy('name')->get(['id', 'name', 'description', 'permissions']);
        $assignedRoleIds = $server->roles()->pluck('roles.id')->toArray();

        return response()->json([
            'roles' => $allRoles->map(fn ($role) => [
                'id' => $role->id,
                'name' => $role->name,
                'description' => $role->description,
                'permissions_count' => count($role->permissions),
                'assigned' => in_array($role->id, $assignedRoleIds),
            ]),
        ]);
    }

    /**
     * Update the roles assigned to this server.
     */
    public function update(Request $request, Server $server): JsonResponse
    {
        // Only server owner can manage roles
        if ($request->user()->id !== $server->owner_id && !$request->user()->root_admin) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'roles' => 'array',
            'roles.*' => 'integer|exists:roles,id',
        ]);

        $server->roles()->sync($validated['roles'] ?? []);

        return response()->json(['success' => true]);
    }
}
