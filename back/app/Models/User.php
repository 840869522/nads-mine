<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;
use App\Utils\GlobalResponse;

class User extends Model{
    protected $table = "platform_user";

    /**
     * 
     *
     * @return array, int
     */
    public static function getAllUser():array {
        try {
            $user = db::select('select * from platform_user');
            return [
                "data"=>$user,
                "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
            ];
        }catch(QueryException $e) {
            return [
                "data"=> null,
                "code"=>GlobalResponse::$DATABASE_SUCCESS_CODE
            ];
        }
    
    }
}
