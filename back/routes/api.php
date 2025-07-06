<?php

use App\Http\Controllers\ad\RefereeController;
use App\Http\Controllers\ad\TeamController;
use Illuminate\Support\Facades\Route;
    use App\Http\Controllers\Users\UserController;
    use App\Http\Controllers\Users\PermissionController;
    use App\Http\Controllers\Users\RoleController;
    use App\Http\Controllers\scenario\ScenarioController;
    use App\Http\Controllers\CategoryController;
    use App\Http\Controllers\CourseController;
    use App\Http\Controllers\ImagesController;
    use App\Http\Controllers\InstancesController;
    use App\Http\Controllers\ContainersController;

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

    /**
     * 管理员账户：admin
     * 密码：  admin123 hash sha256加密后为：240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
     *
     * 测试用户： test_12
     * 测试用户密码： test123 hash sha256 加密后为： ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae
     *
     */

    /**
     * 定义基础分系统路由
     */
    Route::prefix("support")->group(function() {
        Route::prefix("user")->group(function() {
            Route::post("/login",[UserController::class,"login"]);
            Route::post("/id",[UserController::class,"getUserById"])->middleware("jwtcheck");
            Route::post("/search",[UserController::class,"searchUser"])->middleware("jwtcheck:get-all-users");
            Route::post("/all",[UserController::class,"getAllUser"])->middleware("jwtcheck:get-all-users");
            Route::post("/new",[UserController::class,"insertNewUser"]);
            Route::post("/update",[UserController::class,"updateUserInfo"])->middleware("jwtcheck");
            Route::post("/delete",[UserController::class,"deleteUser"])->middleware("jwtcheck:edit-users");
        })->middleware("jwtcheck:support_user");

        Route::prefix("role")->group(function(){
            Route::post("/all",[RoleController::class,"getAllRole"])->middleware("jwtcheck:get-all-roles");
            Route::post("/id",[RoleController::class,"getRoleById"]);
            Route::post("/search",[RoleController::class,"searchRole"])->middleware("jwtcheck:get-all-roles");
            Route::post("/new",[RoleController::class,"newRole"])->middleware("jwtcheck:edit-roles");
            Route::post("/update",[RoleController::class, "updateRole"])->middleware("jwtcheck:edit-roles");
            Route::post("/delete",[RoleController::class,"deleteRole"])->middleware("jwtcheck:edit-roles");
            Route::post("/grant", [RoleController::class,"grantRoles2User"])->middleware("jwtcheck:edit-roles");
            Route::post("/revoke", [RoleController::class,"revokeRoleFromUser"])->middleware("jwtcheck:edit-roles");
        })->middleware("jwtcheck:support_role");

        Route::prefix('permission')->group(function () {
            Route::post('/all', [PermissionController::class, 'getAllPermission'])->middleware('jwtcheck:get-all-permissions');
            Route::post('/id', [PermissionController::class, 'getPermissionById']);
            Route::post("/search",[PermissionController::class,"searchPermission"])->middleware("jwtcheck:get-all-permissions");
            Route::post("/role",[PermissionController::class,"getPermissionsByRoleId"])->middleware("jwtcheck:get-all-permissions");
            Route::post('/new', [PermissionController::class, 'newPermission'])->middleware('jwtcheck:edit-permissions');
            Route::post('/update', [PermissionController::class, 'updatePermission'])->middleware('jwtcheck:edit-permissions');
            Route::post('/delete', [PermissionController::class, 'deletePermission'])->middleware('jwtcheck:edit-permissions');
            Route::post('/grant', [PermissionController::class, 'grantPermission2Role'])->middleware('jwtcheck:edit-permissions');
            Route::post('/revoke', [PermissionController::class, 'revokePermissionFromRole'])->middleware('jwtcheck:edit-permissions');
        })->middleware("jwtcheck:support_permissions");
    })->middleware("jwtcheck:support");


    /**
     * 定义安全实验分系统路由
     */
    Route::prefix("ad")->group(function() {

    })->middleware("jwtcheck:ad");

    /**
     * 定义人员测试分系统路由
     */
    Route::prefix("study")->group(function () {

    })->middleware("jwtcheck:study");

    /**
     * 定义环境构建分系统
     */
    Route::prefix("scene")->group(function () {

    })->middleware("jwtcheck:scene");


    Route::prefix('scenarios')->group(function () {
        Route::get('/', [ScenarioController::class, 'index']);
        Route::post('/', [ScenarioController::class, 'store']);
        Route::delete('/', [ScenarioController::class, 'destroy']);
        // PUT /api/scenarios/{scenario} - 更新一个指定的场景Add commentMore actions
        // 我们使用 {scenario} 作为参数，Laravel 可以自动通过ID找到对应的模型实例 (Route Model Binding)
        Route::put('/{scenario}', [ScenarioController::class, 'update']);


        Route::get('/{scenario}', [ScenarioController::class, 'update']);

    });

    Route::prefix('images')->group(function () {
        Route::get('/', [ImagesController::class, 'index']);
        Route::post('/', [ImagesController::class, 'store']);
        Route::put('/', [ImagesController::class, 'update']);
        Route::delete('/', [ImagesController::class, 'destroy']);
    });

    Route::prefix('instances')->group(function () {
        Route::get('/', [InstancesController::class, 'index']);
        Route::post('/', [InstancesController::class, 'store']);
        Route::put('/', [InstancesController::class, 'update']);
        Route::delete('/', [InstancesController::class, 'destroy']);
    });

    Route::prefix('containers')->group(function () {
        Route::post('/', [ContainersController::class, 'store']);
        Route::post('/{id}', [ContainersController::class, 'action']);
        Route::get('/{id}', [ContainersController::class, 'get']);
        Route::get('/{id}/logs', [ContainersController::class, 'logs']);
        Route::get('/{id}/inspect', [ContainersController::class, 'inspect']);
        Route::get('/{id}/binds', [ContainersController::class, 'binds']);
    });

    Route::prefix('categories')->group(function () {
        Route::get('/', [CategoryController::class, 'index']);
        Route::post('/', [CategoryController::class, 'store'])->middleware('jwtcheck:edit-categories');
    });

    Route::prefix('course-cases')->group(function () {
        Route::get('/', [CourseController::class, 'index']);
        Route::post('/', [CourseController::class, 'store'])->middleware('jwtcheck:edit-courses');
        Route::put('/{id}', [CourseController::class, 'update'])->middleware('jwtcheck:edit-courses');
        Route::delete('/{id}', [CourseController::class, 'destroy'])->middleware('jwtcheck:edit-courses');
    });

Route::prefix('ad/team')->group(function () {
    // 获取所有队伍列表
    // GET /api/ad/team
    Route::get('/', [TeamController::class, 'index']);

    // 创建一个新队伍
    // POST /api/ad/team
    Route::post('/', [TeamController::class, 'store']);

    // 获取单个队伍的详细信息
    // GET /api/ad/team/{team}
    // {team} 是路由模型绑定，Laravel 会自动根据 ID 查找 Team
    Route::get('/{team}', [TeamController::class, 'show']);

    // 更新一个已存在的队伍
    // PUT /api/ad/team/{team}
    Route::put('/{team}', [TeamController::class, 'update']);

    // 删除一个队伍
    // DELETE /api/ad/team/{team}
    Route::delete('/{team}', [TeamController::class, 'destroy']);
});


Route::prefix('ad')->group(function () {

    // 特殊路由: 获取可用的用户列表 (用于创建裁判的下拉菜单)
    // GET /api/ad/available-users
    // 【注意】这个路由应该定义在 `referee` 资源路由之前，以避免路由冲突
    // 如果它在后面，'/available-users' 可能会被误匹配为 '/{referee}'。
    Route::get('available-users', [RefereeController::class, 'availableUsers']);

    // 裁判的 CRUD 路由
    Route::prefix('referee')->group(function () {
        // 获取所有裁判列表
        // GET /api/ad/referee
        Route::get('/', [RefereeController::class, 'index']);

        // 创建一个新裁判
        // POST /api/ad/referee
        Route::post('/', [RefereeController::class, 'store']);

        // 获取单个裁判的详细信息
        // GET /api/ad/referee/{referee}
        // {referee} 是路由模型绑定，Laravel 会自动根据 ID (c_id) 查找 Referee
        Route::get('/{referee}', [RefereeController::class, 'show']);

        // 更新一个已存在的裁判
        // PUT /api/ad/referee/{referee}
        Route::put('/{referee}', [RefereeController::class, 'update']);

        // 删除一个裁判
        // DELETE /api/ad/referee/{referee}
        Route::delete('/{referee}', [RefereeController::class, 'destroy']);
    });

});

?>
