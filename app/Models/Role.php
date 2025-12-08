<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property int $id
 * @property string $name
 * @property string|null $description
 * @property array $permissions
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property \Illuminate\Database\Eloquent\Collection|\Pterodactyl\Models\User[] $users
 * @property \Illuminate\Database\Eloquent\Collection|\Pterodactyl\Models\Server[] $servers
 */
class Role extends Model
{
    /**
     * The resource name for this model when it is transformed into an
     * API representation using fractal.
     */
    public const RESOURCE_NAME = 'role';

    /**
     * The table associated with the model.
     */
    protected $table = 'roles';

    /**
     * Fields that are mass assignable.
     */
    protected $fillable = [
        'name',
        'description',
        'permissions',
    ];

    /**
     * Cast values to correct type.
     */
    protected $casts = [
        'permissions' => 'array',
    ];

    /**
     * Validation rules for this model.
     */
    public static array $validationRules = [
        'name' => 'required|string|max:191|unique:roles,name',
        'description' => 'nullable|string',
        'permissions' => 'required|array',
        'permissions.*' => 'string',
    ];

    /**
     * Gets all users that have this role assigned.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'role_user')
            ->withTimestamps();
    }

    /**
     * Gets all servers that have this role assigned.
     */
    public function servers(): BelongsToMany
    {
        return $this->belongsToMany(Server::class, 'role_server')
            ->withTimestamps();
    }
}
