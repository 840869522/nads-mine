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

    // PUT /api/scenarios/{scenario} - 更新一个指定的场景
    // 我们使用 {scenario} 作为参数，Laravel 可以自动通过ID找到对应的模型实例 (Route Model Binding)
    Route::put('/{scenario}', [ScenarioController::class, 'update']);


    Route::get('/{scenario}', [ScenarioController::class, 'update']);
});

