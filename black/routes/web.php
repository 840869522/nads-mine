<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TestController;
use App\Http\Middleware\TokenCheckMiddleware;
use App\Http\Middleware\Cors;



Route::get('/', function () {
    return view('welcome');
});
Route::middleware(Cors::class)->group(function() {
    Route::post("/test",[TestController::class, "test"]);
});
