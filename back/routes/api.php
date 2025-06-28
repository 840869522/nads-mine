<?php

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

    Route::prefix('permission')->group(function () {
        Route::post('/all', [PermissionController::class, 'getAllPermission'])->middleware('jwtcheck:get-all-permissions');
        Route::post('/id', [PermissionController::class, 'getPermissionById']);
        Route::post('/new', [PermissionController::class, 'newPermission'])->middleware('jwtcheck:edit-permissions');
        Route::post('/update', [PermissionController::class, 'updatePermission'])->middleware('jwtcheck:edit-permissions');
        Route::post('/delete', [PermissionController::class, 'deletePermission'])->middleware('jwtcheck:edit-permissions');
        Route::post('/grant', [PermissionController::class, 'grantPermission2Role'])->middleware('jwtcheck:edit-permissions');
        Route::post('/revoke', [PermissionController::class, 'revokePermissionFromRole'])->middleware('jwtcheck:edit-permissions');
    });

    Route::prefix('scenarios')->group(function () {
        Route::get('/', [ScenarioController::class, 'index']);
        Route::post('/', [ScenarioController::class, 'store']);
        Route::delete('/', [ScenarioController::class, 'destroy']);
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

?>