<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Support\CategoryType;
use App\Support\SharedCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $categories = Category::query()
            ->whereIn('user_id', SharedCatalog::visibleOwnerIds($user))
            ->orderBy('type', 'asc')
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'type', 'created_at']);

        return Inertia::render('categories/index', [
            'types' => CategoryType::labels(),
            'categories' => $categories,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $request->merge([
            'name' => trim((string) $request->input('name')),
        ]);

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('categories', 'name')->where(
                    fn ($q) => $q
                        ->where('user_id', $user->id)
                        ->where('type', (string) $request->input('type')),
                ),
            ],
            'type' => ['required', 'string', Rule::in(CategoryType::values())],
        ]);

        Category::query()->create([
            'user_id' => $user->id,
            'name' => trim($data['name']),
            'type' => $data['type'],
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Category created.')]);

        return back();
    }

    public function update(Request $request, Category $category): RedirectResponse
    {
        if (! SharedCatalog::canAccessCategory($request->user(), $category)) {
            abort(403);
        }

        if (! SharedCatalog::canMutateCategory($request->user(), $category)) {
            abort(403);
        }

        $request->merge([
            'name' => trim((string) $request->input('name')),
        ]);

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('categories', 'name')
                    ->ignore($category->id)
                    ->where(
                        fn ($q) => $q
                            ->where('user_id', $category->user_id)
                            ->where('type', (string) $request->input('type')),
                    ),
            ],
            'type' => ['required', 'string', Rule::in(CategoryType::values())],
        ]);

        $category->fill([
            'name' => $data['name'],
            'type' => $data['type'],
        ]);

        $category->saveOrFail();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Category updated.')]);

        return back();
    }

    public function destroy(Request $request, Category $category): RedirectResponse
    {
        if (! SharedCatalog::canAccessCategory($request->user(), $category)) {
            abort(403);
        }

        if (! SharedCatalog::canMutateCategory($request->user(), $category)) {
            abort(403);
        }

        $category->deleteOrFail();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Category deleted.')]);

        return back();
    }
}
