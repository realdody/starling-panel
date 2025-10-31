import React, { useEffect, useState } from 'react';
import Modal, { RequiredModalProps } from '@/components/elements/Modal';
import { Field as FormikField, Form, Formik, FormikHelpers, useFormikContext } from 'formik';
import { boolean, object, string } from 'yup';
import Field from '@/components/elements/Field';
import FormikFieldWrapper from '@/components/elements/FormikFieldWrapper';
import useFlash from '@/plugins/useFlash';
import createServerBackup from '@/api/server/backups/createServerBackup';
import FlashMessageRender from '@/components/FlashMessageRender';
import Button from '@/components/elements/Button';
import tw from 'twin.macro';
import { Textarea } from '@/components/elements/Input';
import getServerBackups from '@/api/swr/getServerBackups';
import { ServerContext } from '@/state/server';
import FormikSwitch from '@/components/elements/FormikSwitch';
import Can from '@/components/elements/Can';
import getServerBackupCategories from '@/api/swr/getServerBackupCategories';
import { BackupCategory } from '@/api/server/types';
import Select from '@/components/elements/Select';

interface Values {
    name: string;
    ignored: string;
    isLocked: boolean;
    backupCategoryId: string;
}

interface ModalContentProps extends RequiredModalProps {
    categories?: BackupCategory[];
}

const ModalContent = ({ categories, ...props }: ModalContentProps) => {
    const { isSubmitting } = useFormikContext<Values>();

    return (
        <Modal {...props} showSpinnerOverlay={isSubmitting}>
            <Form>
                <FlashMessageRender byKey={'backups:create'} css={tw`mb-4`} />
                <h2 css={tw`text-2xl mb-6`}>Create server backup</h2>
                <Field
                    name={'name'}
                    label={'Backup name'}
                    description={'If provided, the name that should be used to reference this backup.'}
                />
                <div css={tw`mt-6`}>
                    <FormikFieldWrapper
                        name={'ignored'}
                        label={'Ignored Files & Directories'}
                        description={`
                            Enter the files or folders to ignore while generating this backup. Leave blank to use
                            the contents of the .pteroignore file in the root of the server directory if present.
                            Wildcard matching of files and folders is supported in addition to negating a rule by
                            prefixing the path with an exclamation point.
                        `}
                    >
                        <FormikField as={Textarea} name={'ignored'} rows={6} />
                    </FormikFieldWrapper>
                </div>
                <div css={tw`mt-6`}>
                    <FormikFieldWrapper
                        name={'backupCategoryId'}
                        label={'Backup Category'}
                        description={'Assign this backup to a category to apply its independent retention limit.'}
                    >
                        <FormikField as={Select} name={'backupCategoryId'} disabled={!categories}>
                            <option value={''}>No category</option>
                            {(categories || []).map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name} ({category.currentBackupCount}/{category.maxBackups})
                                </option>
                            ))}
                        </FormikField>
                    </FormikFieldWrapper>
                </div>
                <Can action={'backup.delete'}>
                    <div css={tw`mt-6 bg-neutral-700 border border-neutral-800 shadow-inner p-4 rounded`}>
                        <FormikSwitch
                            name={'isLocked'}
                            label={'Locked'}
                            description={'Prevents this backup from being deleted until explicitly unlocked.'}
                        />
                    </div>
                </Can>
                <div css={tw`flex justify-end mt-6`}>
                    <Button type={'submit'} disabled={isSubmitting}>
                        Start backup
                    </Button>
                </div>
            </Form>
        </Modal>
    );
};

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [visible, setVisible] = useState(false);
    const { mutate } = getServerBackups();
    const { data: categories, mutate: mutateCategories } = getServerBackupCategories();

    useEffect(() => {
        clearFlashes('backups:create');
    }, [visible]);

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('backups:create');
        const payload = {
            name: values.name || undefined,
            ignored: values.ignored || undefined,
            isLocked: values.isLocked,
            backupCategoryId: values.backupCategoryId ? Number(values.backupCategoryId) : null,
        };

        createServerBackup(uuid, payload)
            .then((backup) => {
                mutate(
                    (data) => ({ ...data, items: data.items.concat(backup), backupCount: data.backupCount + 1 }),
                    false
                );
                mutateCategories();
                setVisible(false);
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'backups:create', error });
                setSubmitting(false);
            });
    };

    return (
        <>
            {visible && (
                <Formik
                    onSubmit={submit}
                    initialValues={{ name: '', ignored: '', isLocked: false, backupCategoryId: '' }}
                    validationSchema={object().shape({
                        name: string().max(191),
                        ignored: string(),
                        isLocked: boolean(),
                        backupCategoryId: string(),
                    })}
                >
                    <ModalContent
                        appear
                        visible={visible}
                        categories={categories}
                        onDismissed={() => setVisible(false)}
                    />
                </Formik>
            )}
            <Button css={tw`w-full sm:w-auto`} onClick={() => setVisible(true)}>
                Create backup
            </Button>
        </>
    );
};
