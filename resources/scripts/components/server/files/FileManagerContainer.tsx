import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { httpErrorToHuman } from '@/api/http';
import { CSSTransition } from 'react-transition-group';
import Spinner from '@/components/elements/Spinner';
import FileObjectRow from '@/components/server/files/FileObjectRow';
import FileManagerBreadcrumbs from '@/components/server/files/FileManagerBreadcrumbs';
import { FileObject } from '@/api/server/files/loadDirectory';
import NewDirectoryButton from '@/components/server/files/NewDirectoryButton';
import { NavLink, useLocation } from 'react-router-dom';
import Can from '@/components/elements/Can';
import { ServerError } from '@/components/elements/ScreenBlock';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import FileManagerStatus from '@/components/server/files/FileManagerStatus';
import MassActionsBar from '@/components/server/files/MassActionsBar';
import UploadButton from '@/components/server/files/UploadButton';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { useStoreActions } from '@/state/hooks';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { FileActionCheckbox } from '@/components/server/files/SelectFileCheckbox';
import { hashToPath } from '@/helpers';
import style from './style.module.css';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';

type SortField = 'name' | 'modifiedAt' | 'size';
type SortDirection = 'asc' | 'desc';

const ROW_HEIGHT = 52;
const VIRTUALIZATION_THRESHOLD = 350;
const VIRTUALIZATION_OVERSCAN = 12;

const buildSortedFiles = (files: FileObject[], sortField: SortField, sortDirection: SortDirection): FileObject[] => {
    const seen = new Set<string>();
    const uniqueFiles = files.filter((file) => {
        if (seen.has(file.name)) {
            return false;
        }

        seen.add(file.name);
        return true;
    });

    const compare = (a: FileObject, b: FileObject) => {
        let value = 0;

        switch (sortField) {
            case 'modifiedAt':
                value = a.modifiedAt.getTime() - b.modifiedAt.getTime();
                break;
            case 'size':
                value = a.size - b.size;
                break;
            case 'name':
            default:
                value = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }

        return sortDirection === 'asc' ? value : -value;
    };

    const directories = uniqueFiles.filter((file) => !file.isFile).sort(compare);
    const regularFiles = uniqueFiles.filter((file) => file.isFile).sort(compare);

    return [...directories, ...regularFiles];
};

export default () => {
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const { hash } = useLocation();
    const { data: files, error, mutate } = useFileManagerSwr();
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const clearFlashes = useStoreActions((actions) => actions.flashes.clearFlashes);
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);

    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);
    const selectedFiles = ServerContext.useStoreState((state) => state.files.selectedFiles);
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [viewportHeight, setViewportHeight] = useState<number>(() =>
        typeof window !== 'undefined' ? window.innerHeight : 900
    );
    const selectAllRef = useRef<HTMLInputElement | null>(null);
    const virtualizationContainerRef = useRef<HTMLDivElement | null>(null);
    const scrollOffsetRef = useRef(0);
    const scrollRafRef = useRef<number | null>(null);
    const [virtualScrollOffset, setVirtualScrollOffset] = useState(0);
    const [filterTerm, setFilterTerm] = useState('');
    const [isFilterActive, setIsFilterActive] = useState(false);
    const filterInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const handleResize = () => setViewportHeight(window.innerHeight);

        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const sortedFiles = useMemo(() => {
        if (!files) {
            return [];
        }

        return buildSortedFiles(files, sortField, sortDirection);
    }, [files, sortField, sortDirection]);

    const normalizedFilter = filterTerm.trim().toLowerCase();
    const visibleFiles = useMemo(() => {
        if (!normalizedFilter) {
            return sortedFiles;
        }

        return sortedFiles.filter((file) => file.name.toLowerCase().includes(normalizedFilter));
    }, [sortedFiles, normalizedFilter]);

    const shouldVirtualize = visibleFiles.length > VIRTUALIZATION_THRESHOLD;

    const updateVirtualOffset = useCallback(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!virtualizationContainerRef.current) {
            scrollOffsetRef.current = 0;
            setVirtualScrollOffset(0);
            return;
        }

        const rect = virtualizationContainerRef.current.getBoundingClientRect();
        const containerTop = rect.top + window.scrollY;
        const offset = Math.max(0, window.scrollY - containerTop);

        if (scrollOffsetRef.current !== offset) {
            scrollOffsetRef.current = offset;
            setVirtualScrollOffset(offset);
        }
    }, []);

    useEffect(() => {
        if (!shouldVirtualize) {
            setVirtualScrollOffset(0);
            scrollOffsetRef.current = 0;
            return undefined;
        }

        updateVirtualOffset();

        const handleScroll = () => {
            if (scrollRafRef.current !== null) {
                return;
            }

            scrollRafRef.current = window.requestAnimationFrame(() => {
                scrollRafRef.current = null;
                updateVirtualOffset();
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);

            if (scrollRafRef.current !== null) {
                window.cancelAnimationFrame(scrollRafRef.current);
                scrollRafRef.current = null;
            }
        };
    }, [shouldVirtualize, updateVirtualOffset]);

    useEffect(() => {
        updateVirtualOffset();
    }, [visibleFiles.length, sortField, sortDirection, normalizedFilter, updateVirtualOffset]);

    const selectedFilesSet = useMemo(() => new Set(selectedFiles), [selectedFiles]);
    const visibleSelectedCount = useMemo(
        () => visibleFiles.filter((file) => selectedFilesSet.has(file.name)).length,
        [visibleFiles, selectedFilesSet]
    );
    const allSelected = visibleFiles.length > 0 && visibleSelectedCount === visibleFiles.length;
    const partiallySelected = visibleSelectedCount > 0 && visibleSelectedCount < visibleFiles.length;

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = partiallySelected;
        }
    }, [partiallySelected]);

    const handleSortToggle = useCallback(
        (field: SortField) => {
            if (sortField === field) {
                setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
                return;
            }

            setSortField(field);
            setSortDirection(field === 'name' ? 'asc' : 'desc');
        },
        [sortField]
    );

    const sortIndicator = (field: SortField): string => {
        if (sortField !== field) {
            return '↕';
        }

        return sortDirection === 'asc' ? '↑' : '↓';
    };

    const totalVirtualizedHeight = useMemo(() => visibleFiles.length * ROW_HEIGHT, [visibleFiles.length]);

    const [virtualStartIndex, virtualEndIndex] = useMemo(() => {
        if (!shouldVirtualize) {
            return [0, visibleFiles.length] as const;
        }

        const visibleRowCount = Math.max(1, Math.ceil(viewportHeight / ROW_HEIGHT));
        const startIndex = Math.max(0, Math.floor(virtualScrollOffset / ROW_HEIGHT) - VIRTUALIZATION_OVERSCAN);
        const endIndex = Math.min(visibleFiles.length, startIndex + visibleRowCount + VIRTUALIZATION_OVERSCAN * 2);

        return [startIndex, endIndex] as const;
    }, [shouldVirtualize, viewportHeight, virtualScrollOffset, visibleFiles.length]);

    const virtualizedFiles = useMemo(() => {
        if (!shouldVirtualize) {
            return visibleFiles;
        }

        return visibleFiles.slice(virtualStartIndex, virtualEndIndex);
    }, [shouldVirtualize, visibleFiles, virtualStartIndex, virtualEndIndex]);

    useEffect(() => {
        clearFlashes('files');
        setSelectedFiles([]);
        setDirectory(hashToPath(hash));
    }, [hash]);

    useEffect(() => {
        mutate();
    }, [directory]);

    const onSelectAllClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedFiles(e.currentTarget.checked ? visibleFiles.map((file) => file.name) : []);
    };

    const focusFilterInput = useCallback(() => {
        setIsFilterActive(true);
        if (typeof window !== 'undefined') {
            window.requestAnimationFrame(() => {
                filterInputRef.current?.focus();
                filterInputRef.current?.select();
            });
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                focusFilterInput();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusFilterInput]);

    const handleFilterButtonClick = useCallback(() => {
        setIsFilterActive((current) => {
            if (current) {
                setFilterTerm('');
                filterInputRef.current?.blur();
                return false;
            }

            return true;
        });
    }, []);

    useEffect(() => {
        if (isFilterActive) {
            focusFilterInput();
        }
    }, [focusFilterInput, isFilterActive]);

    useEffect(() => {
        setFilterTerm('');
        setIsFilterActive(false);
        filterInputRef.current?.blur();
    }, [directory]);

    const filterVisible = isFilterActive || filterTerm.length > 0;

    if (error) {
        return <ServerError message={httpErrorToHuman(error)} onRetry={() => mutate()} />;
    }

    return (
        <ServerContentBlock title={'File Manager'} showFlashKey={'files'}>
            <ErrorBoundary>
                <div className={'flex flex-wrap-reverse md:flex-nowrap mb-4 gap-4 md:gap-6'}>
                    <FileManagerBreadcrumbs
                        renderLeft={
                            <FileActionCheckbox
                                type={'checkbox'}
                                css={tw`mx-4 !bg-gray-900`}
                                ref={selectAllRef}
                                checked={allSelected}
                                onChange={onSelectAllClick}
                            />
                        }
                    />
                    <div className={'flex-1 flex flex-col gap-3 md:items-end'}>
                        <div className={style.filter_container}>
                            <div className={style.filter_controls}>
                                <Button
                                    type={'button'}
                                    variant={Button.Variants.Secondary}
                                    size={Button.Sizes.Small}
                                    className={style.filter_button}
                                    aria-expanded={filterVisible}
                                    aria-controls={'file-filter-input'}
                                    onClick={handleFilterButtonClick}
                                >
                                    {filterVisible ? 'Clear Filter' : 'Filter Files'}
                                </Button>
                                {filterVisible && (
                                    <Input
                                        id={'file-filter-input'}
                                        ref={filterInputRef}
                                        value={filterTerm}
                                        autoComplete={'off'}
                                        placeholder={'Filter this directory (Ctrl+F)'}
                                        onChange={(event) => setFilterTerm(event.target.value)}
                                        className={style.filter_input}
                                    />
                                )}
                            </div>
                        </div>
                        <Can action={'file.create'}>
                            <div className={style.manager_actions}>
                                <FileManagerStatus />
                                <NewDirectoryButton />
                                <UploadButton />
                                <NavLink to={`/server/${id}/files/new${window.location.hash}`}>
                                    <Button>New File</Button>
                                </NavLink>
                            </div>
                        </Can>
                    </div>
                </div>
            </ErrorBoundary>
            {!files ? (
                <Spinner size={'large'} centered />
            ) : (
                <>
                    {filterVisible && files.length > 0 && !visibleFiles.length ? (
                        <p css={tw`text-sm text-neutral-400 text-center`}>No files match your filter.</p>
                    ) : !files.length ? (
                        <p css={tw`text-sm text-neutral-400 text-center`}>This directory seems to be empty.</p>
                    ) : (
                        <CSSTransition classNames={'fade'} timeout={150} appear in>
                            <div>
                                <div className={style.list_header}>
                                    <div className={style.header_checkbox} />
                                    <div className={style.header_icon} aria-hidden={true} />
                                    <button
                                        type={'button'}
                                        className={`${style.header_button} ${style.header_button_name} ${
                                            sortField === 'name' ? style.header_button_active : ''
                                        }`}
                                        onClick={() => handleSortToggle('name')}
                                    >
                                        <span>Name</span>
                                        <span className={style.header_indicator}>{sortIndicator('name')}</span>
                                    </button>
                                    <button
                                        type={'button'}
                                        className={`${style.header_button} ${style.header_button_size} ${
                                            sortField === 'size' ? style.header_button_active : ''
                                        }`}
                                        onClick={() => handleSortToggle('size')}
                                    >
                                        <span>Size</span>
                                        <span className={style.header_indicator}>{sortIndicator('size')}</span>
                                    </button>
                                    <button
                                        type={'button'}
                                        className={`${style.header_button} ${style.header_button_modified} ${
                                            sortField === 'modifiedAt' ? style.header_button_active : ''
                                        }`}
                                        onClick={() => handleSortToggle('modifiedAt')}
                                    >
                                        <span>Last modified</span>
                                        <span className={style.header_indicator}>{sortIndicator('modifiedAt')}</span>
                                    </button>
                                    <div className={style.header_actions} aria-hidden={true} />
                                </div>
                                {shouldVirtualize ? (
                                    <div
                                        ref={virtualizationContainerRef}
                                        className={style.virtual_wrapper}
                                        style={{ height: totalVirtualizedHeight, minHeight: ROW_HEIGHT * 4 }}
                                    >
                                        {virtualizedFiles.map((file, index) => {
                                            const actualIndex = virtualStartIndex + index;

                                            return (
                                                <FileObjectRow
                                                    key={file.key}
                                                    file={file}
                                                    style={{
                                                        position: 'absolute',
                                                        top: actualIndex * ROW_HEIGHT,
                                                        left: 0,
                                                        right: 0,
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    visibleFiles.map((file) => <FileObjectRow key={file.key} file={file} />)
                                )}
                                <MassActionsBar />
                            </div>
                        </CSSTransition>
                    )}
                </>
            )}
        </ServerContentBlock>
    );
};
