import React, { FormEvent, useState } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import getServerBackupCategories from '@/api/swr/getServerBackupCategories';
import createBackupCategory from '@/api/server/backupCategories/createBackupCategory';
import updateBackupCategory from '@/api/server/backupCategories/updateBackupCategory';
import deleteBackupCategory from '@/api/server/backupCategories/deleteBackupCategory';
import Button from '@/components/elements/Button';
import Input from '@/components/elements/Input';

const BackupCategoriesManager = () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { data: categories, mutate, isValidating } = getServerBackupCategories();
    const { clearFlashes, clearAndAddHttpError } = useFlash();

    const [name, setName] = useState('');
    const [maxBackups, setMaxBackups] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingLimit, setEditingLimit] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const resetCreateForm = () => {
        setName('');
        setMaxBackups('');
    };

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault();
        if (!name.trim() || !maxBackups.trim()) {
            return;
        }

        setSubmitting(true);
        clearFlashes('backups:categories');
        try {
            await createBackupCategory(uuid, {
                name: name.trim(),
                maxBackups: Number(maxBackups),
            });
            await mutate();
            resetCreateForm();
        } catch (error) {
            clearAndAddHttpError({ key: 'backups:categories', error });
        } finally {
            setSubmitting(false);
        }
    };

    const beginEdit = (categoryId: number) => {
        const category = categories?.find((item) => item.id === categoryId);
        if (!category) return;
        setEditingId(categoryId);
        setEditingName(category.name);
        setEditingLimit(category.maxBackups.toString());
        clearFlashes('backups:categories');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingName('');
        setEditingLimit('');
    };

    const saveEdit = async (categoryId: number) => {
        if (!editingName.trim() || !editingLimit.trim()) {
            return;
        }

        setUpdatingId(categoryId);
        clearFlashes('backups:categories');
        try {
            await updateBackupCategory(uuid, categoryId, {
                name: editingName.trim(),
                maxBackups: Number(editingLimit),
            });
            await mutate();
            cancelEdit();
        } catch (error) {
            clearAndAddHttpError({ key: 'backups:categories', error });
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDelete = async (categoryId: number) => {
        setDeletingId(categoryId);
        clearFlashes('backups:categories');
        try {
            await deleteBackupCategory(uuid, categoryId);
            await mutate();
            if (editingId === categoryId) {
                cancelEdit();
            }
        } catch (error) {
            clearAndAddHttpError({ key: 'backups:categories', error });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div css={tw`bg-neutral-800/70 border border-neutral-700 rounded-lg p-6 mb-8`}>
            <div css={tw`flex items-center justify-between mb-4`}>
                <h3 css={tw`text-lg font-semibold`}>Backup Categories</h3>
            </div>
            <FlashMessageRender byKey={'backups:categories'} css={tw`mb-4`} />
            <form css={tw`flex flex-col sm:flex-row sm:items-end gap-4 mb-6`} onSubmit={handleCreate}>
                <div css={tw`flex-1`}>
                    <label css={tw`block text-sm font-semibold mb-2`} htmlFor={'newCategoryName'}>
                        Name
                    </label>
                    <Input
                        id={'newCategoryName'}
                        name={'newCategoryName'}
                        value={name}
                        disabled={submitting}
                        onChange={(event) => setName(event.target.value)}
                    />
                </div>
                <div css={tw`w-full sm:w-40`}>
                    <label css={tw`block text-sm font-semibold mb-2`} htmlFor={'newCategoryLimit'}>
                        Max Backups
                    </label>
                    <Input
                        id={'newCategoryLimit'}
                        name={'newCategoryLimit'}
                        type={'number'}
                        min={1}
                        value={maxBackups}
                        disabled={submitting}
                        onChange={(event) => setMaxBackups(event.target.value)}
                    />
                </div>
                <Button type={'submit'} disabled={submitting || !name.trim() || !maxBackups.trim()}>
                    Create Category
                </Button>
            </form>
            <div css={tw`space-y-3`}>
                {!categories && isValidating ? (
                    <p css={tw`text-sm text-neutral-300`}>Loading categories...</p>
                ) : !categories || categories.length === 0 ? (
                    <p css={tw`text-sm text-neutral-400`}>No backup categories have been created yet.</p>
                ) : (
                    categories.map((category) => {
                        const isEditing = editingId === category.id;
                        const isUpdating = updatingId === category.id;
                        const isDeleting = deletingId === category.id;

                        return (
                            <div
                                key={category.id}
                                css={tw`border border-neutral-700 bg-neutral-900/60 rounded flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-4`}
                            >
                                <div>
                                    {isEditing ? (
                                        <div css={tw`flex flex-col sm:flex-row gap-3`}>
                                            <div>
                                                <label
                                                    css={tw`block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1`}
                                                >
                                                    Name
                                                </label>
                                                <Input
                                                    value={editingName}
                                                    disabled={isUpdating}
                                                    onChange={(event) => setEditingName(event.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label
                                                    css={tw`block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1`}
                                                >
                                                    Max Backups
                                                </label>
                                                <Input
                                                    type={'number'}
                                                    min={1}
                                                    value={editingLimit}
                                                    disabled={isUpdating}
                                                    onChange={(event) => setEditingLimit(event.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p css={tw`text-sm font-semibold text-white`}>{category.name}</p>
                                            <p css={tw`text-xs text-neutral-400 mt-1`}>
                                                {category.currentBackupCount} of {category.maxBackups} backups in use
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div css={tw`flex items-center gap-3`}>
                                    {isEditing ? (
                                        <>
                                            <Button
                                                type={'button'}
                                                size={'small'}
                                                disabled={isUpdating || !editingName.trim() || !editingLimit.trim()}
                                                onClick={() => saveEdit(category.id)}
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                type={'button'}
                                                size={'small'}
                                                isSecondary
                                                disabled={isUpdating}
                                                onClick={cancelEdit}
                                            >
                                                Cancel
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            type={'button'}
                                            size={'small'}
                                            isSecondary
                                            onClick={() => beginEdit(category.id)}
                                        >
                                            Edit
                                        </Button>
                                    )}
                                    <Button
                                        type={'button'}
                                        size={'small'}
                                        color={'red'}
                                        disabled={isDeleting}
                                        onClick={() => handleDelete(category.id)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default BackupCategoriesManager;
