<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Pterodactyl\Models\Role;
use Pterodactyl\Models\Permission;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;

class RoleController extends Controller
{
    /**
     * RoleController constructor.
     */
    public function __construct(
        protected AlertsMessageBag $alert,
        protected ViewFactory $view,
    ) {
    }

    /**
     * Return the role overview page.
     */
    public function index(): View
    {
        return $this->view->make('admin.roles.index', [
            'roles' => Role::query()
                ->withCount(['users', 'servers'])
                ->orderBy('name')
                ->get(),
        ]);
    }

    /**
     * Return the role creation page.
     */
    public function create(): View
    {
        return $this->view->make('admin.roles.new', [
            'permissions' => Permission::permissions(),
        ]);
    }

    /**
     * Handle request to create new role.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191|unique:roles,name',
            'description' => 'nullable|string',
            'permissions' => 'required|array',
            'permissions.*' => 'string',
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'permissions' => $validated['permissions'],
        ]);

        $this->alert->success('Role was created successfully.')->flash();

        return redirect()->route('admin.roles.view', $role->id);
    }

    /**
     * Return the role view/edit page.
     */
    public function view(Role $role): View
    {
        return $this->view->make('admin.roles.view', [
            'role' => $role->loadCount(['users', 'servers']),
            'permissions' => Permission::permissions(),
        ]);
    }

    /**
     * Handle request to update role.
     */
    public function update(Request $request, Role $role): RedirectResponse
    {
        if ($request->input('action') === 'delete') {
            return $this->delete($role);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:191|unique:roles,name,' . $role->id,
            'description' => 'nullable|string',
            'permissions' => 'required|array',
            'permissions.*' => 'string',
        ]);

        $role->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'permissions' => $validated['permissions'],
        ]);

        $this->alert->success('Role was updated successfully.')->flash();

        return redirect()->route('admin.roles.view', $role->id);
    }

    /**
     * Delete a role from the system.
     */
    public function delete(Role $role): RedirectResponse
    {
        $role->delete();

        $this->alert->success('Role was deleted successfully.')->flash();

        return redirect()->route('admin.roles');
    }
}
