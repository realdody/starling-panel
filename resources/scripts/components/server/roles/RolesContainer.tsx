import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { Actions, useStoreActions } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import getServerRoles, { Role } from '@/api/server/roles/getServerRoles';
import updateServerRoles from '@/api/server/roles/updateServerRoles';
import { httpErrorToHuman } from '@/api/http';
import tw from 'twin.macro';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Button from '@/components/elements/Button';

export default () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { addFlash, clearFlashes } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    useEffect(() => {
        clearFlashes('roles');
        getServerRoles(uuid)
            .then((data) => {
                setRoles(data);
                setSelectedRoles(data.filter((r) => r.assigned).map((r) => r.id));
                setLoading(false);
            })
            .catch((error) => {
                console.error(error);
                addFlash({ key: 'roles', type: 'error', message: httpErrorToHuman(error) });
                setLoading(false);
            });
    }, [uuid]);

    const toggleRole = (roleId: number) => {
        setSelectedRoles((prev) =>
            prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
        );
    };

    const saveRoles = () => {
        setSaving(true);
        clearFlashes('roles');
        updateServerRoles(uuid, selectedRoles)
            .then(() => {
                addFlash({ key: 'roles', type: 'success', message: 'Server roles updated successfully.' });
                setSaving(false);
            })
            .catch((error) => {
                console.error(error);
                addFlash({ key: 'roles', type: 'error', message: httpErrorToHuman(error) });
                setSaving(false);
            });
    };

    if (loading) {
        return <Spinner size={'large'} centered />;
    }

    return (
        <ServerContentBlock title={'Roles'}>
            <FlashMessageRender byKey={'roles'} css={tw`mb-4`} />
            <TitledGreyBox title={'Server Roles'} css={tw`mb-6`}>
                <p css={tw`text-sm text-neutral-300 mb-4`}>
                    Users with these roles will have access to this server. Only the server owner can manage roles.
                </p>
                {roles.length === 0 ? (
                    <p css={tw`text-center text-sm text-neutral-400`}>No roles have been created yet.</p>
                ) : (
                    <div css={tw`grid gap-2`}>
                        {roles.map((role) => (
                            <label
                                key={role.id}
                                css={tw`flex items-center p-3 bg-neutral-700 rounded cursor-pointer hover:bg-neutral-600 transition`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedRoles.includes(role.id)}
                                    onChange={() => toggleRole(role.id)}
                                    css={tw`mr-3`}
                                />
                                <div css={tw`flex-1`}>
                                    <span css={tw`font-medium text-neutral-200`}>{role.name}</span>
                                    {role.description && (
                                        <span css={tw`text-sm text-neutral-400 ml-2`}>— {role.description}</span>
                                    )}
                                </div>
                                <span css={tw`text-xs text-neutral-500`}>{role.permissions_count} permissions</span>
                            </label>
                        ))}
                    </div>
                )}
            </TitledGreyBox>
            <div css={tw`flex justify-end`}>
                <Button onClick={saveRoles} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Roles'}
                </Button>
            </div>
        </ServerContentBlock>
    );
};
