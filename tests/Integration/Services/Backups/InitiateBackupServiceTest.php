<?php

namespace Pterodactyl\Tests\Integration\Services\Backups;

use Mockery;
use GuzzleHttp\Psr7\Response;
use Pterodactyl\Models\Backup;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\BackupCategory;
use Pterodactyl\Extensions\Backups\BackupManager;
use Pterodactyl\Tests\Integration\IntegrationTestCase;
use Pterodactyl\Services\Backups\DeleteBackupService;
use Pterodactyl\Services\Backups\InitiateBackupService;
use Pterodactyl\Repositories\Wings\DaemonBackupRepository;
use Pterodactyl\Exceptions\Service\Backup\TooManyBackupsException;

class InitiateBackupServiceTest extends IntegrationTestCase
{
    public function testOverridePrunesOldestCompletedBackupInCategory(): void
    {
        $server = $this->createServerModel();
        /** @var BackupCategory $category */
        $category = BackupCategory::factory()->create([
            'server_id' => $server->id,
            'max_backups' => 2,
        ]);

        /** @var Backup $pendingBackup */
        $pendingBackup = Backup::factory()->create([
            'server_id' => $server->id,
            'backup_category_id' => $category->id,
            'is_successful' => false,
            'completed_at' => null,
        ]);

        /** @var Backup $completedBackup */
        $completedBackup = Backup::factory()->create([
            'server_id' => $server->id,
            'backup_category_id' => $category->id,
            'created_at' => now()->subMinutes(10),
            'completed_at' => now()->subMinutes(5),
        ]);

        $delete = $this->mock(DeleteBackupService::class);
        $delete->expects('handle')->once()->with(Mockery::on(function ($value) use ($completedBackup, $pendingBackup) {
            return $value instanceof Backup
                && $value->id === $completedBackup->id
                && $value->id !== $pendingBackup->id;
        }));

        $manager = $this->mock(BackupManager::class);
        $manager->expects('getDefaultAdapter')->twice()->andReturn(Backup::ADAPTER_WINGS);

        $daemon = $this->mock(DaemonBackupRepository::class);
        $daemon->expects('setServer')->once()->with(Mockery::on(function ($value) use ($server) {
            return $value instanceof Server && $value->id === $server->id;
        }))->andReturnSelf();
        $daemon->expects('setBackupAdapter')->once()->with(Backup::ADAPTER_WINGS)->andReturnSelf();
        $daemon->expects('backup')->once()->with(Mockery::type(Backup::class))->andReturn(new Response());

        $backup = $this->app->make(InitiateBackupService::class)
            ->setCategory($category)
            ->setBypassRateLimit(true)
            ->handle($server, 'Nightly', true);

        $this->assertSame($category->id, $backup->backup_category_id);
        $this->assertSame('Nightly', $backup->name);
    }

    public function testOverrideWillNotDeletePendingUncategorizedBackup(): void
    {
        $server = $this->createServerModel(['backup_limit' => 1]);

        Backup::factory()->create([
            'server_id' => $server->id,
            'backup_category_id' => null,
            'is_successful' => false,
            'completed_at' => null,
        ]);

        $this->mock(DeleteBackupService::class)->shouldNotReceive('handle');
        $this->mock(BackupManager::class)->shouldNotReceive('getDefaultAdapter');
        $this->mock(DaemonBackupRepository::class)->shouldNotReceive('setServer');

        $this->expectException(TooManyBackupsException::class);

        $this->app->make(InitiateBackupService::class)
            ->setBypassRateLimit(true)
            ->handle($server, null, true);
    }
}
