<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('backup_categories', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('server_id');
            $table->string('name', 191);
            $table->unsignedInteger('max_backups');
            $table->timestamps();

            $table->unique(['server_id', 'name']);

            $table->foreign('server_id')->references('id')->on('servers')->cascadeOnDelete();
        });

        Schema::table('backups', function (Blueprint $table) {
            $table->unsignedInteger('backup_category_id')
                ->nullable()
                ->after('server_id')
                ->references('id')
                ->on('backup_categories')
                ->nullOnDelete();
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->unsignedInteger('backup_category_id')
                ->nullable()
                ->after('payload')
                ->references('id')
                ->on('backup_categories')
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
