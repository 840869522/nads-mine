<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('instances', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('type');
            $table->string('status');
            $table->string('ip_address')->nullable();
            $table->string('image_name');
            $table->string('cpu_usage')->nullable();
            $table->string('memory_usage')->nullable();
            $table->string('disk_usage')->nullable();
            $table->string('uptime')->nullable();
            $table->string('node_id')->nullable();
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('instances');
    }
};
