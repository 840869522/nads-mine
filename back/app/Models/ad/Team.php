<?php
// file: app/Models/ad/Team.php

namespace App\Models\ad;

use App\Models\Users\UserModel;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Team extends Model
{
    use HasFactory;

    protected $table = 'c_teams';
    protected $primaryKey = 'c_id';
    public $timestamps = false;

    protected $fillable = [
        'c_name',
        // 'c_color', // <-- 已移除
        'c_description',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            UserModel::class,
            'c_teams_users',
            'team_id',
            'user_id'
        );
    }
}
