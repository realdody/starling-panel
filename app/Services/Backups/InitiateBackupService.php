<?php

namespace Pterodactyl\Services\Backups;

use Carbon\CarbonImmutable;
use Illuminate\Database\ConnectionInterface;
use InvalidArgumentException;
use Pterodactyl\Exceptions\Service\Backup\TooManyBackupsException;
use Pterodactyl\Extensions\Backups\BackupManager;
use Pterodactyl\Models\Backup;
use Pterodactyl\Models\BackupCategory;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Eloquent\BackupRepository;
use Pterodactyl\Repositories\Wings\DaemonBackupRepository;
use Ramsey\Uuid\Uuid;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Webmozart\Assert\Assert;

class InitiateBackupService
{
    private const LOCK_TIMEOUT = 60;

    private array $ignoredFiles = [];

    private bool $isLocked = false;

    private bool $bypassRateLimit = false;

    private ?BackupCategory $category = null;

    /**
     * InitiateBackupService constructor.
     */
    public function __construct(
        private BackupRepository $repository,
        private ConnectionInterface $connection,
        private DaemonBackupRepository $daemonBackupRepository,
        private DeleteBackupService $deleteBackupService,
        private BackupManager $backupManager,
    ) {
    }

    /**
     * Set if the backup should be locked once it is created which will prevent
     * its deletion by users or automated system processes.
     */
    public function setIsLocked(bool $isLocked): self
    {
        $this->isLocked = $isLocked;

        return $this;
    }

    /**
     * Set if the backup should bypass the rate limit check.
     * Useful for automated scheduled backups.
     */
    public function setBypassRateLimit(bool $bypass): self
    {
        $this->bypassRateLimit = $bypass;

        return $this;
    }

    /**
     * Sets the files to be ignored by this backup.
     *
     * @param string[]|null $ignored
     */
    public function setIgnoredFiles(?array $ignored): self
    {
        if (is_array($ignored)) {
            foreach ($ignored as $value) {
                Assert::string($value); // @phpstan-ignore staticMethod.alreadyNarrowedType
            }
        }

        // Set the ignored files to be any values that are not empty in the array. Don't use
        // the PHP empty function here incase anything that is "empty" by default (0, false, etc.)
        // were passed as a file or folder name.
        $this->ignoredFiles = is_null($ignored) ? [] : array_filter($ignored, function ($value) {
            return strlen($value) > 0;
        });

        return $this;
    }

    public function setCategory(?BackupCategory $category): self
    {
        $this->category = $category;

        return $this;
    }

    /**
     * Initiates the backup process for a server on Wings.
     *
     * @throws \Throwable
     * @throws TooManyBackupsException
     * @throws TooManyRequestsHttpException
     */
    public function handle(Server $server, ?string $name = null, bool $override = false): Backup
    {
        $this->acquireLock($server);

        try {
            // Only enforce rate limit if not bypassed (e.g., for scheduled backups).
            if (!$this->bypassRateLimit) {
                $limit = config('backups.throttles.limit');
                $period = config('backups.throttles.period');
                if ($period > 0) {
                    $previous = $this->repository->getBackupsGeneratedDuringTimespan($server->id, $period);
                    if ($previous->count() >= $limit) {
                        $message = sprintf('Only %d backups may be generated within a %d second span of time.', $limit, $period);

                        throw new TooManyRequestsHttpException((int) CarbonImmutable::now()->diffInSeconds($previous->last()->created_at->addSeconds($period)), $message);
                    }
                }
            }

            if ($this->category && $this->category->server_id !== $server->id) {
                throw new InvalidArgumentException('The provided backup category does not belong to the specified server.');
            }

            if ($this->category) {
                $categoryLimit = $this->category->max_backups;
                $categoryBackups = $this->repository->getNonFailedBackups($server, $this->category->id);
                $categoryCount = (clone $categoryBackups)->count();

                if ($categoryCount >= $categoryLimit) {
                    if (!$override) {
                        throw new TooManyBackupsException($categoryLimit, $this->category->name);
                    }

                    /** @var Backup|null $oldestCategoryBackup */
                    $oldestCategoryBackup = (clone $categoryBackups)
                        ->whereNotNull('completed_at')
                        ->where('is_successful', true)
                        ->where('is_locked', false)
                        ->orderBy('completed_at')
                        ->orderBy('id')
                        ->first();

                    if (!$oldestCategoryBackup) {
                        throw new TooManyBackupsException($categoryLimit, $this->category->name);
                    }

                    $this->deleteBackupService->handle($oldestCategoryBackup);
                }
            }

            if (!$this->category) {
                $totalBackupsQuery = $this->repository->getNonFailedBackups($server)->whereNull('backup_category_id');
                $totalBackups = (clone $totalBackupsQuery)->count();

                if ($server->backup_limit > 0 && $totalBackups >= $server->backup_limit) {
                    if (!$override) {
                        throw new TooManyBackupsException($server->backup_limit);
                    }

                    /** @var Backup|null $oldest */
                    $oldest = (clone $totalBackupsQuery)
                        ->whereNotNull('completed_at')
                        ->where('is_successful', true)
                        ->where('is_locked', false)
                        ->orderBy('completed_at')
                        ->orderBy('id')
                        ->first();

                    if (!$oldest) {
                        throw new TooManyBackupsException($server->backup_limit);
                    }

                    $this->deleteBackupService->handle($oldest);
                }
            }

            return $this->connection->transaction(function () use ($server, $name) {
                /** @var Backup $backup */
                $backup = $this->repository->create([
                    'server_id' => $server->id,
                    'backup_category_id' => $this->category?->id,
                    'uuid' => Uuid::uuid4()->toString(),
                    'name' => trim($name) ?: sprintf('Backup at %s', CarbonImmutable::now()->toDateTimeString()),
                    'ignored_files' => array_values($this->ignoredFiles),
                    'disk' => $this->backupManager->getDefaultAdapter(),
                    'is_locked' => $this->isLocked,
                ], true, true);

                $this->daemonBackupRepository->setServer($server)
                    ->setBackupAdapter($this->backupManager->getDefaultAdapter())
                    ->backup($backup);

                return $backup;
            });
        } finally {
            $this->releaseLock($server);
        }
    }

    private function acquireLock(Server $server): void
    {
        $result = (array) $this->connection->selectOne(
            'SELECT GET_LOCK(?, ?) AS acquired_lock',
            [$this->lockName($server), self::LOCK_TIMEOUT]
        );

        if ((int) ($result['acquired_lock'] ?? 0) !== 1) {
            throw new TooManyRequestsHttpException(self::LOCK_TIMEOUT, 'Another backup operation is already in progress for this server.');
        }
    }

    private function releaseLock(Server $server): void
    {
        try {
            $this->connection->selectOne('SELECT RELEASE_LOCK(?) AS released_lock', [$this->lockName($server)]);
        } catch (\Throwable) {
            // Nothing to do here: if the connection is gone MySQL releases the lock automatically.
        }
    }

    private function lockName(Server $server): string
    {
        return sprintf('server-backup:%d', $server->id);
    }
}
