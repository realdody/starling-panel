<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Pterodactyl\Models\BackupCategory;
use Pterodactyl\Models\Server;

/**
 * @extends Factory<BackupCategory>
 */
class BackupCategoryFactory extends Factory
{
    protected $model = BackupCategory::class;

    public function definition(): array
    {
        return [
            'server_id' => Server::factory(),
            'name' => $this->faker->unique()->words(2, true),
            'max_backups' => $this->faker->numberBetween(1, 20),
        ];
    }
}
