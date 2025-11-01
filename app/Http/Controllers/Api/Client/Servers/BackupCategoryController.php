<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\Backups\DeleteBackupCategoryRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Backups\StoreBackupCategoryRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Backups\UpdateBackupCategoryRequest;
use Pterodactyl\Models\BackupCategory;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Server;
use Pterodactyl\Transformers\Api\Client\BackupCategoryTransformer;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class BackupCategoryController extends ClientApiController
{
    public function index(Request $request, Server $server): array
    {
        if (!$request->user()->can(Permission::ACTION_BACKUP_READ, $server)) {
            throw new AuthorizationException();
        }

        $categories = $server->backupCategories()
            ->orderBy('name')
            ->withCount(['backups as current_backup_count' => function ($query) {
                $query->where(function ($query) {
                    $query->whereNull('completed_at')
                        ->orWhere('is_successful', true);
                });
            }])
            ->get();

        return $this->fractal->collection($categories)
            ->transformWith($this->getTransformer(BackupCategoryTransformer::class))
            ->toArray();
    }

    public function store(StoreBackupCategoryRequest $request, Server $server): array
    {
        $category = $server->backupCategories()->create([
            'name' => $request->input('name'),
            'max_backups' => $request->integer('max_backups'),
        ]);

        $category->loadCount(['backups as current_backup_count' => function ($query) {
            $query->where(function ($query) {
                $query->whereNull('completed_at')
                    ->orWhere('is_successful', true);
            });
        }]);

        return $this->fractal->item($category)
            ->transformWith($this->getTransformer(BackupCategoryTransformer::class))
            ->toArray();
    }

    public function update(UpdateBackupCategoryRequest $request, Server $server, BackupCategory $category): array
    {
        if ($category->server_id !== $server->id) {
            throw new NotFoundHttpException();
        }

        $category->update([
            'name' => $request->input('name', $category->name),
            'max_backups' => $request->has('max_backups') ? $request->integer('max_backups') : $category->max_backups,
        ]);

        $category->loadCount(['backups as current_backup_count' => function ($query) {
            $query->where(function ($query) {
                $query->whereNull('completed_at')
                    ->orWhere('is_successful', true);
            });
        }]);

        return $this->fractal->item($category)
            ->transformWith($this->getTransformer(BackupCategoryTransformer::class))
            ->toArray();
    }

    public function delete(DeleteBackupCategoryRequest $request, Server $server, BackupCategory $category): JsonResponse
    {
        if ($category->server_id !== $server->id) {
            throw new NotFoundHttpException();
        }

        DB::transaction(function () use ($category): void {
            $category->backups()->withTrashed()->update(['backup_category_id' => null]);
            $category->tasks()->update(['backup_category_id' => null]);

            $category->delete();
        });

        return new JsonResponse(null, JsonResponse::HTTP_NO_CONTENT);
    }
}
