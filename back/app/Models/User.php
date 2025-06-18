<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB as db;


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
                "code"=>200
            ];
        }catch(QueryException $e) {
            return [
                "data"=> null,
                "code"=>400
            ];
        }
    
    }
}
