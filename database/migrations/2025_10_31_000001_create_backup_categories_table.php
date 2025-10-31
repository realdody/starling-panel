<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('backup_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->string('name', 191);
            $table->unsignedInteger('max_backups');
            $table->timestamps();

            $table->unique(['server_id', 'name']);
        });

        Schema::table('backups', function (Blueprint $table) {
            $table->foreignId('backup_category_id')
                ->nullable()
                ->after('server_id')
                ->constrained('backup_categories')
                ->nullOnDelete();
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('backup_category_id')
                ->nullable()
                ->after('payload')
                ->constrained('backup_categories')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['backup_category_id']);
            $table->dropColumn('backup_category_id');
        });

        Schema::table('backups', function (Blueprint $table) {
            $table->dropForeign(['backup_category_id']);
            $table->dropColumn('backup_category_id');
        });

        Schema::dropIfExists('backup_categories');
    }
};
