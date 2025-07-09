<?php


    use Illuminate\Support\Facades\Route;
    use App\Http\Controllers\Users\UserController;
    use App\Http\Controllers\Users\PermissionController;
    use App\Http\Controllers\Users\RoleController;
    use App\Http\Controllers\scenario\ScenarioController;
    use App\Http\Controllers\scenario\DrillController;
    use App\Http\Controllers\scenario\InstanceController;
    use App\Http\Controllers\scenario\SwitchController;
    use App\Http\Controllers\Docker\ImagesController;
    use App\Http\Controllers\Docker\InstancesController;
    use App\Http\Controllers\Docker\ContainersController;
    use App\Http\Controllers\ad\RefereeController;
    use App\Http\Controllers\ad\TeamController;
    use App\Http\Controllers\Course\CourseController;
    use App\Http\Controllers\Course\CategoryController;
    use App\Http\Controllers\Course\ResourceController;
    use App\Http\Controllers\Vm\MainCli\VmController;
    use App\Http\Controllers\examination\TestController;


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
    Route::post("support/user/login",[UserController::class,"login"]);
    Route::prefix("support")->group(function() {
        Route::prefix("user")->group(function() {
            Route::post("/id",[UserController::class,"getUserById"]);
            Route::post("/search",[UserController::class,"searchUser"]);
            Route::post("/all",[UserController::class,"getAllUser"]);
            Route::post("/new",[UserController::class,"insertNewUser"]);
            Route::post("/update",[UserController::class,"updateUserInfo"]);
            Route::post("/delete",[UserController::class,"deleteUser"]);
        })->middleware("jwtcheck:support_user");

        Route::prefix("role")->group(function(){
            Route::post("/all",[RoleController::class,"getAllRole"]);
            Route::post("/id",[RoleController::class,"getRoleById"]);
            Route::post("/search",[RoleController::class,"searchRole"]);
            Route::post("/new",[RoleController::class,"newRole"]);
            Route::post("/update",[RoleController::class, "updateRole"]);
            Route::post("/delete",[RoleController::class,"deleteRole"]);
            Route::post("/grant", [RoleController::class,"grantRoles2User"]);
            Route::post("/revoke", [RoleController::class,"revokeRoleFromUser"]);
        })->middleware("jwtcheck:support_role");

        Route::prefix('permission')->group(function () {
            Route::post('/all', [PermissionController::class, 'getAllPermission']);
            Route::post('/id', [PermissionController::class, 'getPermissionById']);
            Route::post("/search",[PermissionController::class,"searchPermission"]);
            Route::post("/role",[PermissionController::class,"getPermissionsByRoleId"]);
            Route::post('/new', [PermissionController::class, 'newPermission']);
            Route::post('/update', [PermissionController::class, 'updatePermission']);
            Route::post('/delete', [PermissionController::class, 'deletePermission']);
            Route::post('/grant', [PermissionController::class, 'grantPermission2Role']);
            Route::post('/revoke', [PermissionController::class, 'revokePermissionFromRole']);
        })->middleware("jwtcheck:support_permissions");
    })->middleware("jwtcheck:support");


    /**
     * 定义安全实验分系统路由
     */
    Route::prefix("ad")->group(function() {
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

        Route::prefix('team')->group(function () {
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
    })->middleware("jwtcheck:ad");

    /**
     * 定义人员测试分系统路由
     */
    Route::prefix("study")->group(function () {
        Route::prefix('courses')->group(function(){
            Route::get('/',[CourseController::class,'index'])->middleware('can:view-courses')->name('courses.index');
            Route::get('/{id}',[CourseController::class,'show'])->middleware('can:view-courses')->name('courses.show');
            Route::post('/',[CourseController::class,'store'])->middleware('can:create-course')->name('courses.store');
            Route::put('/{id}',[CourseController::class,'update'])->middleware('can:edit-courses')->name('courses.update');
            Route::delete('/{id}',[CourseController::class,'destroy'])->middleware('can:delete-courses')->name('courses.destroy');
            Route::post('/{courseId}/users', [CourseController::class, 'addUser'])->middleware('can:manage-courses')->name('courses.addUser');
        })->middleware('jwtcheck');

        Route::prefix('categories')->group(function(){
            Route::get('/', [CategoryController::class, 'index'])->name('categories.index');
            Route::post('/', [CategoryController::class, 'store'])->name('categories.store');
            Route::put('/{id}', [CategoryController::class, 'update'])->name('categories.update');
            Route::delete('/{id}', [CategoryController::class, 'destroy'])->name('categories.destroy');
        })->middleware('jwtcheck:study_');

        Route::prefix('courses/{courseId}/resources')->group(function () {
            Route::get('/', [ResourceController::class, 'index'])->name('resources.index');
            Route::post('/', [ResourceController::class, 'store'])->middleware('jwtcheck:manage-resources')->name('resources.store');
            Route::post('/upload', [ResourceController::class, 'upload'])->middleware('jwtcheck:manage-resources')->name('resources.upload');
            Route::delete('/{id}', [ResourceController::class, 'destroy'])->middleware('jwtcheck:manage-resources')->name('resources.destroy');
        })->middleware('jwtcheck');
    })->middleware("jwtcheck:study");

    /**
     * 定义环境构建分系统
     */
    Route::prefix("scene")->group(function () {

    })->middleware("jwtcheck:scene");


    Route::prefix('scenarios')->group(function () {

        // GET 获取所有场景列表
        Route::get('/', [ScenarioController::class, 'index']);
        // POST 创建一个新场景
        Route::post('/', [ScenarioController::class, 'store']);
        // DELETE  删除一个指定场景
        Route::delete('/', [ScenarioController::class, 'destroy']);
        // PUT 修改场景
        Route::put('/{scenario}', [ScenarioController::class, 'update']);
        //GET 获取场景
        Route::get('/{scenario}', [ScenarioController::class, 'update']);
         // 启动场景
        Route::post('/{scenario}/start', [DrillController::class, 'startDrill']);


    });

    Route::prefix('scenariosinstances')->group(function () {


        // GET /api/scenariosinstances/switches - 获取所有场景实例下的所有交换机【前端无该功能】
        Route::get('/switches', [SwitchController::class, 'index']);

        // GET /api/scenariosinstances/{instance}/switches - 获取指定场景实例下的交换机列表
        // 这个路由会调用 SwitchController 的 show 方法，并自动注入对应的 SceneInstance 对象
        Route::get('/{instance:c_scene_instances_id}/switches', [SwitchController::class, 'show']);
        // GET /api/scenarios/instances - 获取所有场景实例列表
        Route::get('/', [InstanceController::class, 'index']);
        // --- 获取单个场景实例的容器详细信息 ---
        Route::get('/{instance:c_scene_instances_id}', [InstanceController::class, 'show']);

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
        Route::post('/', [ContainersController::class, 'create']);
        Route::post('/{id}', [ContainersController::class, 'action']);
        Route::get('/{id}', [ContainersController::class, 'get']);
        Route::get('/{id}/logs', [ContainersController::class, 'logs']);
        Route::get('/{id}/inspect', [ContainersController::class, 'inspect']);
        Route::get('/{id}/binds', [ContainersController::class, 'binds']);
    });


    // Route::prefix('courses')->group(function(){
    //     Route::get('/',[CourseController::class,'index'])->middleware('can:view-courses')->name('courses.index');
    //     Route::get('/{id}',[CourseController::class,'show'])->middleware('can:view-courses')->name('courses.show');
    //     Route::post('/',[CourseController::class,'store'])->middleware('can:create-course')->name('courses.store');
    //     Route::put('/{id}',[CourseController::class,'update'])->middleware('can:edit-courses')->name('courses.update');
    //     Route::delete('/{id}',[CourseController::class,'destroy'])->middleware('can:delete-courses')->name('courses.destroy');
    //     Route::post('/{courseId}/users', [CourseController::class, 'addUser'])->middleware('can:manage-courses')->name('courses.addUser');
    // })->middleware('jwtcheck');

    // Route::prefix('categories')->group(function(){
    //     Route::get('/', [CategoryController::class, 'index'])->name('categories.index');
    //     Route::post('/', [CategoryController::class, 'store'])->middleware('jwtcheck:manage-categories')->name('categories.store');
    //     Route::put('/{id}', [CategoryController::class, 'update'])->middleware('jwtcheck:manage-categories')->name('categories.update');
    //     Route::delete('/{id}', [CategoryController::class, 'destroy'])->middleware('jwtcheck:manage-categories')->name('categories.destroy');
    // })->middleware('jwtcheck');

    // Route::prefix('courses/{courseId}/resources')->group(function () {
    //     Route::get('/', [ResourceController::class, 'index'])->name('resources.index');
    //     Route::post('/', [ResourceController::class, 'store'])->middleware('jwtcheck:manage-resources')->name('resources.store');
    //     Route::post('/upload', [ResourceController::class, 'upload'])->middleware('jwtcheck:manage-resources')->name('resources.upload');
    //     Route::delete('/{id}', [ResourceController::class, 'destroy'])->middleware('jwtcheck:manage-resources')->name('resources.destroy');
    // })->middleware('jwtcheck');

    Route::prefix('vms')->group(function () {
        $c = \App\Http\Controllers\Vm\MainCli\VmController::class;
        Route::get('/', [$c, 'listVms']);
        Route::get('/images', [$c, 'listVmImages']);
        Route::post('/create', [$c, 'createVm']);
        Route::get('/{vm_name}/guac', [$c, 'getGuacInfo']);
        Route::get('/{vm_id}', [$c, 'getVmInfo']);
        Route::post('/{vm_id}/actions/{action}', [$c, 'manageVmLifecycle']);
        Route::get('/{vm_id}/snapshots', [$c, 'listVmSnapshots']);
        Route::post('/{vm_id}/snapshots', [$c, 'createVmSnapshot']);
        Route::post('/{vm_id}/snapshots/{snapshot_id}/revert', [$c, 'revertVmSnapshot']);
        Route::delete('/{vm_id}/snapshots/{snapshot_id}', [$c, 'deleteVmSnapshot']);
        Route::get('/{vm_id}/storage/disks', [$c, 'listVmDisks']);
        Route::get('/{vm_id}/storage/cdroms', [$c, 'listVmCdroms']);
        Route::get('/{vm_id}/network/vnics', [$c, 'listVmVnics']);
        Route::get('/{vm_id}/metrics', [$c, 'getVmRealtimeMetrics']);
        Route::get('/{vm_id}/events', [$c, 'listVmEvents']);
    });

    Route::prefix('examination')->group(function () {
        Route::prefix('test')->group(function(){
            Route::post('/', [TestController::class, 'index']);
        });
    });

?>
