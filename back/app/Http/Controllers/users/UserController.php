<?php

namespace App\Http\Controllers\users;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;

class UserController extends Controller
{
    public function test() {
        $res = User::getAllUser();
        return response()->json([
            "code" => 200,
            "mes" => "success",
            "data" => $res
        ]);
    }
}
