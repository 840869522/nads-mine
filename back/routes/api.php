<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\users\UserController;
use Illuminate\Contracts\Auth\UserProvider;
use App\Http\Controllers\scenario\ScenarioController;
/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::prefix("user")->group(function() {
    Route::post("/login",[UserController::class,"login"]);
    Route::post("/test",[UserController::class,"test"])->middleware("jwtcheck");
});


Route::prefix('scenarios')->group(function () {
    // GET /api/scenarios - 获取所有场景列表
    Route::get('/', [ScenarioController::class, 'index']);
    // POST /api/scenarios - 创建一个新场景 (这个您已经有了)
    Route::post('/', [ScenarioController::class, 'store']);
    // DELETE /api/scenarios - 删除一个指定场景
    Route::delete('/', [ScenarioController::class, 'destroy']);
});


Route::prefix('images')->group(function () {
    Route::get('/', [\App\Http\Controllers\ImagesController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\ImagesController::class, 'store']);
    Route::put('/', [\App\Http\Controllers\ImagesController::class, 'update']);
    Route::delete('/', [\App\Http\Controllers\ImagesController::class, 'destroy']);
});

Route::prefix('instances')->group(function () {
    Route::get('/', [\App\Http\Controllers\InstancesController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\InstancesController::class, 'store']);
    Route::put('/', [\App\Http\Controllers\InstancesController::class, 'update']);
    Route::delete('/', [\App\Http\Controllers\InstancesController::class, 'destroy']);
});

Route::prefix('containers')->group(function () {
    Route::post('/', [\App\Http\Controllers\ContainersController::class, 'store']);
    Route::post('/{id}', [\App\Http\Controllers\ContainersController::class, 'action']);
    Route::get('/{id}/logs', [\App\Http\Controllers\ContainersController::class, 'logs']);
});
