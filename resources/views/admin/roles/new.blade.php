@extends('layouts.admin')

@section('title')
    New Role
@endsection

@section('content-header')
    <h1>New Role<small>Create a new permission role.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.roles') }}">Roles</a></li>
        <li class="active">New</li>
    </ol>
@endsection

@section('content')
    <form action="{{ route('admin.roles') }}" method="POST">
        @csrf

        <div class="row">
            <div class="col-md-6">
                <div class="box box-primary">
                    <div class="box-header with-border">
                        <h3 class="box-title">Role Details</h3>
                    </div>

                    <div class="box-body">
                        <div class="form-group">
                            <label for="pName" class="form-label">Name</label>
                            <input type="text" id="pName" name="name" class="form-control" value="{{ old('name') }}" required />
                            <p class="text-muted small">A unique identifier for this role.</p>
                        </div>

                        <div class="form-group">
                            <label for="pDescription" class="form-label">Description</label>
                            <textarea id="pDescription" name="description" class="form-control" rows="3" style="resize: none;">{{ old('description') }}</textarea>
                            <p class="text-muted small">A brief description of what this role is for.</p>
                        </div>
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
                                            {{ in_array("$category.$key", old('permissions', [])) ? 'checked' : '' }} />
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
                        <button type="submit" class="btn btn-success btn-sm pull-right">Create Role</button>
                    </div>
                </div>
            </div>
        </div>
    </form>
@endsection
