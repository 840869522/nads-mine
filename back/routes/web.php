<?php

    use Illuminate\Support\Facades\Route;

    /*
    |--------------------------------------------------------------------------
    | Web Routes
    |--------------------------------------------------------------------------
    |
    | Here is where you can register web routes for your application. These
    | routes are loaded by the RouteServiceProvider within a group which
    | contains the "web" middleware group. Now create something great!
    |
    */

    Route::get('/', function () {
        return view('welcome');
    });

    Route::prefix('vms')->middleware('api')->group(function () {
        $c = App\Http\Controllers\Vm\MainCli\VmController::class;
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
?>