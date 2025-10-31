<?php

namespace Pterodactyl\Exceptions\Service\Backup;

use Pterodactyl\Exceptions\DisplayException;

class TooManyBackupsException extends DisplayException
{
    /**
     * TooManyBackupsException constructor.
     */
    public function __construct(int $backupLimit, ?string $categoryName = null)
    {
        $resource = $categoryName ? sprintf('the "%s" backup category', $categoryName) : 'this server';

        parent::__construct(sprintf('Cannot create a new backup, %s has reached its limit of %d backups.', $resource, $backupLimit));
    }
}
