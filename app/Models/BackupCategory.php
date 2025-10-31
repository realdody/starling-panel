<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * @property int $id
 * @property int $server_id
 * @property string $name
 * @property int|null $max_backups
 * @property Server $server
 */
class BackupCategory extends Model
{
    /** @use HasFactory<\Database\Factories\BackupCategoryFactory> */
    use HasFactory;

    protected $table = 'backup_categories';

    protected $casts = [
        'id' => 'int',
        'server_id' => 'int',
        'max_backups' => 'int',
    ];

    protected $fillable = [
        'server_id',
        'name',
        'max_backups',
    ];

    public static array $validationRules = [
        'server_id' => 'required|numeric|exists:servers,id',
        'name' => 'required|string|max:191',
        'max_backups' => 'required|integer|min:1',
    ];

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function backups(): HasMany
    {
        return $this->hasMany(Backup::class, 'backup_category_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'backup_category_id');
    }
}
