<?php

    use Illuminate\Http\Request;
    use Illuminate\Support\Facades\Route;
    use App\Http\Controllers\Users\UserController;
    use App\Http\Controllers\Users\PermissionController;
    use App\Http\Controllers\Users\RoleController;
    use App\Http\Controllers\scenario\ScenarioController;
use App\Models\PermissionModel;

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


    Route::prefix("user")->group(function() {
        Route::post("/login",[UserController::class,"login"]);
        Route::post("/all",[UserController::class,"getAllUser"])->middleware("jwtcheck:get-all-users");
    });
    
    Route::prefix("role")->group(function(){
        Route::post("/all",[RoleController::class,"getAllRole"])->middleware("jwtcheck:get-all-roles");
        Route::post("/id",[RoleController::class,"getRoleById"]);
        Route::post("/new",[RoleController::class,"newRole"])->middleware("jwtcheck:edit-roles");
        Route::post("/update",[RoleController::class, "updateRole"])->middleware("jwtcheck:edit-roles");
        Route::post("/delete",[RoleController::class,"deleteRole"])->middleware("jwtcheck:edit-roles");
        Route::post("/grant", [PermissionController::class,"grantRoles2User"])->middleware("jwtcheck:edit-roles");
        Route::post("/revoke", [PermissionController::class,"revokeRoleFromUser"])->middleware("jwtcheck:edit-roles");
    });

    Route::prefix("permission")->group(function() {
        Route::post("/all",[PermissionController::class,"getAllPermission"])->middleware("jwtcheck:get-all-permissions");
        Route::post("/id",[PermissionController::class,"getPermissionById"]);
        Route::post("/new",[PermissionController::class,"newPermission"])->middleware("jwtcheck:edit-permissions");
        Route::post("/update",[PermissionController::class,"updatePermission"])->middleware("jwtcheck:edit-permissions");
        Route::post("/delete",[PermissionController::class,"deletePermission"])->middleware("jwtcheck:edit-permissions");
        Route::post("/grant", [PermissionController::class,"grantPermission2Role"])->middleware("jwtcheck:edit-permissions");
        Route::post("/revoke", [PermissionController::class,"revokePermissionFromRole"])->middleware("jwtcheck:edit-permissions");
    });


    Route::prefix('scenarios')->group(function () {
        // GET /api/scenarios - 获取所有场景列表
        Route::get('/', [ScenarioController::class, 'index']);
        // POST /api/scenarios - 创建一个新场景 (这个您已经有了)
        Route::post('/', [ScenarioController::class, 'store']);
        // DELETE /api/scenarios - 删除一个指定场景
        Route::delete('/', [ScenarioController::class, 'destroy']);
    });

?>