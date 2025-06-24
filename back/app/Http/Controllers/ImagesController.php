<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Image;
use Illuminate\Support\Str;

class ImagesController extends Controller
{
    public function index()
    {
        return response()->json(Image::all());
    }

    public function store(Request $request)
    {
        $data = $request->all();
        $data['id'] = Str::uuid()->toString();
        Image::create($data);
        return response()->json(['ok' => true, 'id' => $data['id']]);
    }

    public function update(Request $request)
    {
        $data = $request->all();
        $image = Image::findOrFail($data['id']);
        $image->fill($data);
        $image->save();
        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request)
    {
        $id = $request->query('id');
        if ($id) {
            Image::where('id', $id)->delete();
        }
        return response()->json(['ok' => true]);
    }
}
