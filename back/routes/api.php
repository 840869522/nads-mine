<?php


    use App\Http\Controllers\ad\AdConfigController;
    use App\Http\Controllers\scenario\ScenarioPermissionController;
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
    use App\Http\Controllers\Vm\VmController;
    use App\Http\Controllers\Course\TestController;
    use App\Http\Controllers\Experiment\ExperimentController;
    use App\Http\Controllers\Experiment\ExperimentResourceController;
    use App\Http\Controllers\Course\CoursePermissionController;
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
 * 较为特殊的路由
 */
Route::prefix("")->group(function () {
    Route::post("support/user/login", [UserController::class, "login"]);
    Route::post("/support/permission/all_menu", [PermissionController::class, "getSystemAllMenu"]);
    Route::post("/support/permission/all_permission", [PermissionController::class, "getSystemAllPermission"]);
});

// scene_vms_instances | 交换机实例 |           | support | /scenario/sceneinstances/all-switches |         1 | 交换机实例 | CubeTransparentIcon |        1 |   11 |

/**
 * 定义基础分系统路由
 */
Route::prefix("support")->group(function () {
    Route::prefix("user")->group(function () {
        Route::post("/id", [UserController::class, "getUserById"]);
        Route::post("/search", [UserController::class, "searchUser"]);
        Route::post("/all", [UserController::class, "getAllUser"]);
        Route::post("/new", [UserController::class, "insertNewUser"]);
        Route::post("/update", [UserController::class, "updateUserInfo"]);
        Route::post("/delete", [UserController::class, "deleteUser"]);
        Route::post("/update_pwd", [UserController::class, "updateUserPassword"]);
        Route::post("/update_common", [UserController::class, "updateCommonUser"]);
    });

    Route::prefix("role")->group(function () {
        Route::post("/all", [RoleController::class, "getAllRole"]);
        Route::post("/id", [RoleController::class, "getRoleById"]);
        Route::post("/search", [RoleController::class, "searchRole"]);
        Route::post("/new", [RoleController::class, "newRole"]);
        Route::post("/update", [RoleController::class, "updateRole"]);
        Route::post("/delete", [RoleController::class, "deleteRole"]);
    });

    Route::prefix('permission')->group(function () {
        Route::post('/all', [PermissionController::class, 'getAllPermission']);
        Route::post('/all_label', [PermissionController::class, 'getAllPermssionLable']);
        Route::post('/id', [PermissionController::class, 'getPermissionById']);
        Route::post("/search", [PermissionController::class, "searchPermission"]);
        Route::post('/new', [PermissionController::class, 'newPermission']);
        Route::post('/update', [PermissionController::class, 'updatePermission']);
        Route::post('/delete', [PermissionController::class, 'deletePermission']);
    });
});

/**
 * 定义人员测试分系统路由
 */
Route::prefix("study")->group(function () {
    Route::prefix('courses')->group(function(){
        Route::get('/',[CourseController::class,'index']);
        Route::get('/{id}',[CourseController::class,'show']);
        Route::post('/',[CourseController::class,'store']);
        Route::put('/{id}',[CourseController::class,'update']);
        Route::delete('/{id}',[CourseController::class,'destroy']);
    });
    Route::prefix('permissions')->group(function(){
        Route::get('/usernames', [CoursePermissionController::class, 'getAllUsernames']);
        Route::get('/courses/{courseId}/users', [CoursePermissionController::class, 'getUsers']);
        Route::post('/courses/{courseId}/users', [CoursePermissionController::class, 'syncUsers']);
        Route::post('/courses/{courseId}/add-user', [CoursePermissionController::class, 'addUserToCourse']);
    });
    Route::prefix('categories')->group(function(){
        Route::get('/', [CategoryController::class, 'index']);
        Route::post('/', [CategoryController::class, 'store']);
        Route::put('/{id}', [CategoryController::class, 'update']);
        Route::delete('/{id}', [CategoryController::class, 'destroy']);
    });

    Route::prefix('courses/{courseId}/resources')->group(function () {
        Route::get('/', [ResourceController::class, 'index']);
        Route::post('/', [ResourceController::class, 'store']);
        Route::post('/upload', [ResourceController::class, 'upload']);
        Route::delete('/{id}', [ResourceController::class, 'destroy']);
    });

    Route::prefix('courses/{courseId}/experiments')->group(function () {
        Route::get('/', [ExperimentController::class, 'index']);
        Route::post('/', [ExperimentController::class, 'store']);
        Route::put('/{experimentId}', [ExperimentController::class, 'update']);
        Route::delete('/{experimentId}', [ExperimentController::class, 'destroy']);
        Route::prefix('{experimentId}/resources')->group(function () {
            Route::get('/', [ExperimentResourceController::class, 'index']);
            Route::post('/', [ExperimentResourceController::class, 'store']);
            Route::post('/upload', [ExperimentResourceController::class, 'upload']);
            Route::delete('/{resourceId}', [ExperimentResourceController::class, 'destroy']);
        });
    });
    // 新增路由：获取资源文件
    Route::get('/resources/{c_resource_id}', [ResourceController::class, 'download']);
    // 新增实验资源下载路由
    Route::get('/experiment-resources/{c_resource_id}', [ExperimentResourceController::class, 'download']);
    Route::get('/users', [CourseController::class, 'getAllUsers']);
});

/**
 * 定义环境构建分系统
 */
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

Route::get('/permissions/users', [ScenarioPermissionController::class, 'getAllUsers'])
;
Route::prefix('scenarios/{scenarioId}/permissions')->group(function () {
    Route::get('/', [ScenarioPermissionController::class, 'getPermissions']);
    Route::post('/', [ScenarioPermissionController::class, 'savePermissions']);

});

Route::prefix('scenariosinstances')->group(function () {
    Route::delete('/switches/{switchName}', [SwitchController::class, 'destroy']);
    Route::get('/switches', [SwitchController::class, 'index']);
    Route::get('/{instance:c_scene_instances_id}/switches', [SwitchController::class, 'show']);
    Route::get('/', [InstanceController::class, 'index']);
    Route::delete('/{instance}', [InstanceController::class, 'destroy']);
    Route::get('/{instance:c_scene_instances_id}', [InstanceController::class, 'show']);
    Route::get('/{instance_id}/vms', [VmController::class, 'listVmsBySceneInstance']);
    Route::post('/{instance}/teardown', [InstanceController::class, 'tearDownResources']);
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
    Route::get('/{id}/info', [ContainersController::class, 'info']);
});



Route::prefix('vms')->group(function () {
    $c = \App\Http\Controllers\Vm\VmController::class;
    Route::get('/', [$c, 'listVms']);
    Route::get('/images', [$c, 'listVmImages']);
    Route::get('/image-options', [$c, 'listVmImageOptions']);
    Route::post('/create', [$c, 'createVm']);
    Route::get('/{vm_name}/guac', [$c, 'getGuacInfo']);
    Route::get('/{vm_id}', [$c, 'getVmInfo']);
    Route::delete('/{vm_id}', [$c, 'deleteVm']);
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

Route::prefix('study')->group(function () {
    Route::prefix('test')->group(function(){
        Route::post('/question_add', [TestController::class, 'question_add']);
        Route::post('/question_up', [TestController::class, 'question_up']);
        Route::post('/question_del', [TestController::class, 'question_del']);
        Route::post('/question_list', [TestController::class, 'question_list']);
        Route::post('/question_info', [TestController::class, 'question_info']);
        Route::post('/test_add', [TestController::class, 'test_add']);
        Route::post('/test_update', [TestController::class, 'test_update']);
        Route::post('/test_del', [TestController::class, 'test_del']);
        Route::get('/test_list', [TestController::class, 'test_list']);
        Route::post('/test_info', [TestController::class, 'test_info']);
        Route::post('/paper_rules_add', [TestController::class, 'paper_rules_add']);
        Route::post('/paper_rules_update', [TestController::class, 'paper_rules_update']);
        Route::post('/paper_rules_del', [TestController::class, 'paper_rules_del']);
        Route::post('/get_paper_rules_info', [TestController::class, 'get_paper_rules_info']);
        Route::get('get_papers', [TestController::class, 'get_papers']);
        Route::post('/send_papers', [TestController::class, 'send_papers']);
        Route::post('/submit_papers', [TestController::class, 'submit_papers']);
        Route::post('/get_answers_name_list', [TestController::class, 'get_answers_name_list']);
        Route::post('/get_answers_name_info', [TestController::class, 'get_answers_name_info']);
        Route::post('/batch_answers_name', [TestController::class, 'batch_answers_name']);
        Route::post('/query_results', [TestController::class, 'query_results']);
        Route::post('/batch_question_add', [TestController::class, 'batch_question_add']);
        Route::post('/redis_test', [TestController::class, 'redis_test']);
        Route::get('/get_all_paper_rules', [TestController::class, 'get_all_paper_rules']);
        Route::get('get_paper_details', [TestController::class, 'get_paper_details']);
        Route::post('export_paper_to_word', [TestController::class, 'export_paper_to_word']);
    });
});


    Route::get('ad/users', [UserController::class, 'getAllUser']);
    Route::prefix('ad/team')->group(function () {
        Route::get('/', [TeamController::class, 'index']); // TeamController.index
        Route::post('/', [TeamController::class, 'store']);
        Route::get('/{team}', [TeamController::class, 'show']);
        Route::put('/{team}', [TeamController::class, 'update']);
        Route::delete('/{team}', [TeamController::class, 'destroy']);
    });
    Route::apiResource('ad-configs', AdConfigController::class);

      Route::post('/ad-configs/{adConfig}/start', [\App\Http\Controllers\ad\AdController::class, 'startDrill'])->name('ad-configs.start-drill');
//    Route::prefix('ad-configs/{adConfig}')->group(function () {
//        Route::post('/start', [AdConfigController::class, 'start'])->name('ad-configs.start');
//        Route::post('/stop', [AdConfigController::class, 'stop'])->name('ad-configs.stop');
//    });

Route::prefix('ad')->group(function () {

    Route::get('users', [RefereeController::class, 'availableUsers'])->name('ad.users');
    Route::get('team', [TeamController::class, 'index'])->name('ad.teams');

    Route::get('/referees/all', [RefereeController::class, 'index']);

    Route::get('available-referee-users', [RefereeController::class, 'availableUsers'])->name('ad.available-users'); // 改为更明确的名称

    Route::post('/{ad}/start', [\App\Http\Controllers\ad\AdController::class, 'startDrill']);

    // 你可能还有其他辅助路由，可以像这样添加
    // Route::get('some-other-data', [SomeController::class, 'getData']);
});

/**
 * 定义安全实验分系统路由
 */
//Route::prefix("ad")->group(function() {
//
//})->middleware("jwtcheck:ad");
//
//?>
