@extends('layouts.admin')

@section('title')
    Role: {{ $role->name }}
@endsection

@section('content-header')
    <h1>{{ $role->name }}<small>{{ $role->description }}</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.roles') }}">Roles</a></li>
        <li class="active">{{ $role->name }}</li>
    </ol>
@endsection

@section('content')
    <form action="{{ route('admin.roles.view', $role->id) }}" method="POST">
        @csrf
        @method('PATCH')

        <div class="row">
            <div class="col-md-6">
                <div class="box box-primary">
                    <div class="box-header with-border">
                        <h3 class="box-title">Role Details</h3>
                    </div>

                    <div class="box-body">
                        <div class="form-group">
                            <label for="pName" class="form-label">Name</label>
                            <input type="text" id="pName" name="name" class="form-control" value="{{ old('name', $role->name) }}" required />
                        </div>

                        <div class="form-group">
                            <label for="pDescription" class="form-label">Description</label>
                            <textarea id="pDescription" name="description" class="form-control" rows="3" style="resize: none;">{{ old('description', $role->description) }}</textarea>
                        </div>
                    </div>

                    <div class="box-footer">
                        <p class="text-muted small">
                            <strong>{{ $role->users_count }}</strong> users and
                            <strong>{{ $role->servers_count }}</strong> servers use this role.
                        </p>
                    </div>
                </div>

                <div class="box box-danger">
                    <div class="box-header with-border">
                        <h3 class="box-title">Danger Zone</h3>
                    </div>

                    <div class="box-body">
                        <p class="text-muted">Deleting this role will remove it from all users and servers.</p>
                    </div>

                    <div class="box-footer">
                        <button type="submit" name="action" value="delete" class="btn btn-danger btn-sm">Delete Role</button>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="box box-primary">
                    <div class="box-header with-border">
                        <h3 class="box-title">Permissions</h3>
                    </div>

                    <div class="box-body">
                        @foreach ($permissions as $category => $data)
                            <div class="form-group">
                                <label class="form-label">{{ ucfirst($category) }}</label>
                                <p class="text-muted small">{{ $data['description'] }}</p>

                                @foreach ($data['keys'] as $key => $description)
                                    <div class="checkbox icheck-primary">
                                        <input type="checkbox" id="perm_{{ $category }}_{{ $key }}" name="permissions[]" value="{{ $category }}.{{ $key }}"
                                            {{ in_array("$category.$key", old('permissions', $role->permissions)) ? 'checked' : '' }} />
                                        <label for="perm_{{ $category }}_{{ $key }}">
                                            <strong>{{ $key }}</strong> &mdash; {{ $description }}
                                        </label>
                                    </div>
                                @endforeach
                            </div>
                            <hr />
                        @endforeach
                    </div>

                    <div class="box-footer">
                        <button type="submit" class="btn btn-primary btn-sm pull-right">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    </form>
@endsection
