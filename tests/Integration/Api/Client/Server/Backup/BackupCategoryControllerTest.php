<?php

namespace Pterodactyl\Tests\Integration\Api\Client\Server\Backup;

use Carbon\CarbonImmutable;
use Pterodactyl\Models\Backup;
use Pterodactyl\Models\BackupCategory;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Schedule;
use Pterodactyl\Models\Task;
use Pterodactyl\Tests\Integration\Api\Client\ClientApiIntegrationTestCase;

class BackupCategoryControllerTest extends ClientApiIntegrationTestCase
{
    public function testIndexReturnsCategoriesWithCounts(): void
    {
        [$user, $server] = $this->generateTestAccount();

        /** @var BackupCategory $category */
        $category = BackupCategory::factory()->create([
            'server_id' => $server->id,
            'max_backups' => 5,
        ]);

        Backup::factory()->create([
            'server_id' => $server->id,
            'backup_category_id' => $category->id,
            'is_successful' => true,
            'completed_at' => CarbonImmutable::now(),
        ]);

        $this->actingAs($user)
            ->getJson($this->link($server, '/backup-categories'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.attributes.name', $category->name)
            ->assertJsonPath('data.0.attributes.max_backups', 5)
            ->assertJsonPath('data.0.attributes.current_backup_count', 1);
    }

    public function testStoreCreatesCategory(): void
    {
        [$user, $server] = $this->generateTestAccount();

        $response = $this->actingAs($user)->postJson($this->link($server, '/backup-categories'), [
            'name' => 'Daily',
            'max_backups' => 7,
        ])->assertOk();

        $this->assertDatabaseHas('backup_categories', [
            'server_id' => $server->id,
            'name' => 'Daily',
            'max_backups' => 7,
        ]);

        $response->assertJsonPath('attributes.name', 'Daily')
            ->assertJsonPath('attributes.max_backups', 7)
            ->assertJsonPath('attributes.current_backup_count', 0);
    }

    public function testStoreValidatesUniqueNamePerServer(): void
    {
        [$user, $server] = $this->generateTestAccount();
        BackupCategory::factory()->create(['server_id' => $server->id, 'name' => 'Daily']);

        $this->actingAs($user)
            ->postJson($this->link($server, '/backup-categories'), [
                'name' => 'Daily',
                'max_backups' => 5,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.0.meta.source_field', 'name');
    }

    public function testStoreRequiresPermission(): void
    {
        [$user, $server] = $this->generateTestAccount([Permission::ACTION_SCHEDULE_UPDATE]);

        $this->actingAs($user)
            ->postJson($this->link($server, '/backup-categories'), [
                'name' => 'Daily',
                'max_backups' => 3,
            ])
            ->assertForbidden();
    }

    public function testUpdateModifiesCategory(): void
    {
        [$user, $server] = $this->generateTestAccount();
        /** @var BackupCategory $category */
        $category = BackupCategory::factory()->create(['server_id' => $server->id, 'name' => 'Daily', 'max_backups' => 4]);

        $this->actingAs($user)
            ->postJson($this->link($server, "/backup-categories/{$category->id}"), [
                'name' => 'Weekly',
                'max_backups' => 2,
            ])
            ->assertOk()
            ->assertJsonPath('attributes.name', 'Weekly')
            ->assertJsonPath('attributes.max_backups', 2);

        $this->assertDatabaseHas('backup_categories', [
            'id' => $category->id,
            'name' => 'Weekly',
            'max_backups' => 2,
        ]);
    }

    public function testUpdateFailsForForeignCategory(): void
    {
        [$user, $server] = $this->generateTestAccount();
        $otherServer = $this->createServerModel();
        $category = BackupCategory::factory()->create(['server_id' => $otherServer->id]);

        $this->actingAs($user)
            ->postJson($this->link($server, "/backup-categories/{$category->id}"), [
                'name' => 'Daily',
            ])
            ->assertNotFound();
    }

    public function testDeleteRemovesCategoryAndDetachesRelationships(): void
    {
        [$user, $server] = $this->generateTestAccount();
        /** @var BackupCategory $category */
        $category = BackupCategory::factory()->create(['server_id' => $server->id]);

        /** @var Backup $backup */
        $backup = Backup::factory()->create([
            'server_id' => $server->id,
            'backup_category_id' => $category->id,
        ]);

        $this->actingAs($user)
            ->deleteJson($this->link($server, "/backup-categories/{$category->id}"))
            ->assertNoContent();

        $this->assertDatabaseMissing('backup_categories', ['id' => $category->id]);
        $this->assertDatabaseHas('backups', ['id' => $backup->id, 'backup_category_id' => null]);
    }

    public function testDeleteDetachesScheduledTasks(): void
    {
        [$user, $server] = $this->generateTestAccount();

        /** @var Schedule $schedule */
        $schedule = Schedule::factory()->create(['server_id' => $server->id]);

        /** @var BackupCategory $category */
        $category = BackupCategory::factory()->create(['server_id' => $server->id]);

        /** @var Task $task */
        $task = Task::factory()->create([
            'schedule_id' => $schedule->id,
            'sequence_id' => 1,
            'action' => Task::ACTION_BACKUP,
            'payload' => '',
            'backup_category_id' => $category->id,
        ]);

        $this->actingAs($user)
            ->deleteJson($this->link($server, "/backup-categories/{$category->id}"))
            ->assertNoContent();

        $this->assertDatabaseMissing('backup_categories', ['id' => $category->id]);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'backup_category_id' => null]);
    }

    public function testDeleteClearsSoftDeletedBackups(): void
    {
        [$user, $server] = $this->generateTestAccount();

        /** @var BackupCategory $category */
        $category = BackupCategory::factory()->create(['server_id' => $server->id]);

        /** @var Backup $trashedBackup */
        $trashedBackup = Backup::factory()->create([
            'server_id' => $server->id,
            'backup_category_id' => $category->id,
        ]);

        $trashedBackup->delete();

        $this->actingAs($user)
            ->deleteJson($this->link($server, "/backup-categories/{$category->id}"))
            ->assertNoContent();

        $this->assertDatabaseMissing('backup_categories', ['id' => $category->id]);
        $this->assertDatabaseHas('backups', ['id' => $trashedBackup->id, 'backup_category_id' => null]);
    }
}
