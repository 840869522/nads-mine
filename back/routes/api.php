<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\users\UserController;
use Illuminate\Contracts\Auth\UserProvider;
use App\Http\Controllers\scenario\ScenarioController;
use App\Http\Controllers\drill\TeamController;

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

// === 新增的队伍管理路由 ===
// 为了匹配前端 'http://127.0.0.1:8000/api/drill/team' 的请求
// 我们创建一个 'drill' 前缀的分组
Route::prefix('drill')->group(function () {
    // 在 'drill' 分组内，再为 'team' 创建资源路由
    // GET    /api/drill/team -> TeamController@index
    Route::get('/team', [TeamController::class, 'index']);
    
    // POST   /api/drill/team -> TeamController@store
    Route::post('/team', [TeamController::class, 'store']);

    // 您可以将来在这里轻松地扩展其他路由
    // PUT    /api/drill/team/{team} -> TeamController@update
    // DELETE /api/drill/team/{team} -> TeamController@destroy
});