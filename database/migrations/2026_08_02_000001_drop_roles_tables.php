<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The role system was removed from the panel. Drop any leftover tables
     * from existing installations that previously created them.
     */
    public function up(): void
    {
        Schema::dropIfExists('role_server');
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('roles');
    }

    public function down(): void
    {
        // The role system is not coming back; intentionally left empty.
    }
};
