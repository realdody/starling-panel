<?php

namespace Pterodactyl\Tests\Integration\Api\Client\Server\Backup;

use Mockery;
use Carbon\CarbonImmutable;
use Pterodactyl\Models\Backup;
use Pterodactyl\Models\BackupCategory;
use Pterodactyl\Repositories\Wings\DaemonBackupRepository;
use Pterodactyl\Tests\Integration\Api\Client\ClientApiIntegrationTestCase;

class CreateServerBackupTest extends ClientApiIntegrationTestCase
{
    public function testBackupsRespectCategoryLimit(): void
    {
        [$user, $server] = $this->generateTestAccount();
        $server->update(['backup_limit' => 1]);

        /** @var BackupCategory $category */
        $category = BackupCategory::factory()->create(['server_id' => $server->id, 'max_backups' => 2]);

        $repository = Mockery::mock(DaemonBackupRepository::class);
        $repository->shouldReceive('setServer')->twice()->with($server)->andReturnSelf();
        $repository->shouldReceive('setBackupAdapter')->twice()->andReturnSelf();
        $repository->shouldReceive('backup')->twice()->andReturnSelf();
        $this->instance(DaemonBackupRepository::class, $repository);

        // First backup
        $this->actingAs($user)
            ->postJson($this->link($server, '/backups'), [
                'name' => 'First',
                'backup_category_id' => $category->id,
            ])
            ->assertOk();

        // Second backup should still succeed, despite server-level limit being 1.
        $this->actingAs($user)
            ->postJson($this->link($server, '/backups'), [
                'name' => 'Second',
                'backup_category_id' => $category->id,
            ])
            ->assertOk();

        // Third backup should fail due to category limit.
        $this->actingAs($user)
            ->postJson($this->link($server, '/backups'), [
                'name' => 'Third',
                'backup_category_id' => $category->id,
            ])
            ->assertStatus(400)
            ->assertJsonPath('errors.0.detail', 'Cannot create a new backup, the "' . $category->name . '" backup category has reached its limit of 2 backups.');

        $this->assertCount(2, Backup::query()->where('backup_category_id', $category->id)->get());
    }

    public function testCategoryMustBelongToServer(): void
    {
        [$user, $server] = $this->generateTestAccount();
        $otherServer = $this->createServerModel();
        $foreignCategory = BackupCategory::factory()->create(['server_id' => $otherServer->id]);

        $repository = Mockery::mock(DaemonBackupRepository::class);
        $this->instance(DaemonBackupRepository::class, $repository);

        $this->actingAs($user)
            ->postJson($this->link($server, '/backups'), [
                'name' => 'Invalid',
                'backup_category_id' => $foreignCategory->id,
            ])
            ->assertNotFound();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
