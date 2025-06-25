<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Users\UserController;
use App\Http\Controllers\Users\PermissionController;
use App\Http\Controllers\Users\RoleController;
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
    
    Route::prefix("role")->group(function(){
        Route::post("/all",[RoleController::class,"getAllRole"])->middleware("jwtcheck");
    });
    Route::prefix("permission")->group(function() {
        Route::post("/all",[PermissionController::class,"getAllPermission"])->middleware("jwtcheck:get-all-user");
        // Route::
    });

?>