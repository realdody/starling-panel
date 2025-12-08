@extends('layouts.admin')

@section('title')
    Roles
@endsection

@section('content-header')
    <h1>Roles<small>Manage permission roles that can be assigned to users and servers.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Roles</li>
    </ol>
@endsection

@section('content')
    <div class="row">
        <div class="col-xs-12">
            <div class="box box-primary">
                <div class="box-header with-border">
                    <h3 class="box-title">Role List</h3>

                    <div class="box-tools">
                        <a href="{{ route('admin.roles.new') }}" class="btn btn-sm btn-primary">Create New</a>
                    </div>
                </div>

                <div class="box-body table-responsive no-padding">
                    <table class="table table-hover">
                        <tbody>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Description</th>
                                <th class="text-center">Users</th>
                                <th class="text-center">Servers</th>
                                <th class="text-center">Permissions</th>
                            </tr>

                            @foreach ($roles as $role)
                                <tr>
                                    <td><code>{{ $role->id }}</code></td>
                                    <td><a href="{{ route('admin.roles.view', $role->id) }}">{{ $role->name }}</a></td>
                                    <td>{{ Str::limit($role->description, 50) }}</td>
                                    <td class="text-center">{{ $role->users_count }}</td>
                                    <td class="text-center">{{ $role->servers_count }}</td>
                                    <td class="text-center">{{ count($role->permissions) }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
@endsection
