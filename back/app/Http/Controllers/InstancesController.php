<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Instance;
use Illuminate\Support\Str;

class InstancesController extends Controller
{
    public function index()
    {
        return response()->json(Instance::all());
    }

    public function store(Request $request)
    {
        $data = $request->all();
        $data['id'] = Str::uuid()->toString();
        Instance::create($data);
        return response()->json(['ok' => true, 'id' => $data['id']]);
    }

    public function update(Request $request)
    {
        $data = $request->all();
        $inst = Instance::findOrFail($data['id']);
        $inst->fill($data);
        $inst->save();
        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request)
    {
        $id = $request->query('id');
        if ($id) Instance::where('id', $id)->delete();
        return response()->json(['ok' => true]);
    }
}
