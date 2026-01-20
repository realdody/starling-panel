<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('role_server', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            $table->unsignedInteger('server_id');
            $table->timestamps();

            $table->unique(['role_id', 'server_id']);

            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->foreign('server_id')->references('id')->on('servers')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_server');
    }
};
