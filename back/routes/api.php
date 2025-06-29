<?php


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


    Route::prefix("user")->group(function() {
        Route::post("/login",[UserController::class,"login"]);
        Route::post("/id",[UserController::class,"getUserById"])->middleware("jwtcheck");
        Route::post("/all",[UserController::class,"getAllUser"])->middleware("jwtcheck:get-all-users");
        Route::post("/new",[UserController::class,"insertNewUser"]);
        Route::post("/update",[UserController::class,"updateUserInfo"])->middleware("jwtcheck");
        Route::post("/delete",[UserController::class,"deleteUser"])->middleware("jwtcheck:edit-users");
    });

    Route::prefix("role")->group(function(){
        Route::post("/all",[RoleController::class,"getAllRole"])->middleware("jwtcheck:get-all-roles");
        Route::post("/id",[RoleController::class,"getRoleById"]);
        Route::post("/new",[RoleController::class,"newRole"])->middleware("jwtcheck:edit-roles");
        Route::post("/update",[RoleController::class, "updateRole"])->middleware("jwtcheck:edit-roles");
        Route::post("/delete",[RoleController::class,"deleteRole"])->middleware("jwtcheck:edit-roles");
        Route::post("/grant", [RoleController::class,"grantRoles2User"])->middleware("jwtcheck:edit-roles");
        Route::post("/revoke", [RoleController::class,"revokeRoleFromUser"])->middleware("jwtcheck:edit-roles");
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
        // PUT /api/scenarios/{scenario} - 更新一个指定的场景Add commentMore actions
        // 我们使用 {scenario} 作为参数，Laravel 可以自动通过ID找到对应的模型实例 (Route Model Binding)
        Route::put('/{scenario}', [ScenarioController::class, 'update']);


        Route::get('/{scenario}', [ScenarioController::class, 'update']);

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
        Route::get('/{id}', [\App\Http\Controllers\ContainersController::class, 'get']);
        Route::get('/{id}/logs', [\App\Http\Controllers\ContainersController::class, 'logs']);
        Route::get('/{id}/inspect', [\App\Http\Controllers\ContainersController::class, 'inspect']);
        Route::get('/{id}/binds', [\App\Http\Controllers\ContainersController::class, 'binds']);
    });

?>
