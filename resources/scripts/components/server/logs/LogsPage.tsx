import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { Actions, useStoreActions } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import CopyOnClick from '@/components/elements/CopyOnClick';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Button from '@/components/elements/Button';
import tw from 'twin.macro';
import axios from 'axios';

// Collapsible log section types
const LogSectionNames = ['ERROR', 'WARN', 'INFO', 'OTHER'] as const;
type LogSection = typeof LogSectionNames[number];

interface McLogEntry {
    id: string;
    url: string;
    uploadedAt: string;
}

interface InsightsData {
    version: string;
    name: string;
    analysis: {
        problems: Array<{
            message: string;
            solutions?: Array<{ message: string }>;
        }>;
    };
}

const LogsPage: React.FC = () => {
    const [collapsed, setCollapsed] = useState<Record<LogSection, boolean>>({
        ERROR: false,
        WARN: false,
        INFO: true,
        OTHER: true,
    });
    const [showOriginal, setShowOriginal] = useState(false);

    const [logs, setLogs] = useState<string[]>([]);
    const [mclogsUrls, setMclogsUrls] = useState<McLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedLogData, setSelectedLogData] = useState<string | null>(null);
    const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const [currentLogsPage, setCurrentLogsPage] = useState<number>(1);
    const [currentHistoryPage, setCurrentHistoryPage] = useState<number>(1);
    const [logsPerPage, setLogsPerPage] = useState<number>(5);
    const maxPageButtons = 5;

    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [logSortOrder, setLogSortOrder] = useState<'newest' | 'oldest'>('newest');

    const { uuid } = ServerContext.useStoreState((state) => state.server.data!);
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    const clearFlashes = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes.clearFlashes);
    const addError = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes.addError);

    const sortedLogs = React.useMemo(() => {
        const sorted = [...logs];
        sorted.sort();
        if (logSortOrder === 'newest') {
            sorted.reverse();
        }
        return sorted;
    }, [logs, logSortOrder]);

    const paginatedLogs = sortedLogs.slice((currentLogsPage - 1) * logsPerPage, currentLogsPage * logsPerPage);
    const paginatedHistory = mclogsUrls.slice((currentHistoryPage - 1) * logsPerPage, currentHistoryPage * logsPerPage);

    const totalLogsPages = Math.ceil(sortedLogs.length / logsPerPage);
    const totalHistoryPages = Math.ceil(mclogsUrls.length / logsPerPage);

    const handleLogsPageChange = (pageNumber: number) => {
        setCurrentLogsPage(pageNumber);
    };

    const handleHistoryPageChange = (pageNumber: number) => {
        setCurrentHistoryPage(pageNumber);
    };

    const handleLogsPerPageChange = (newPerPage: number) => {
        setLogsPerPage(newPerPage);
        setCurrentLogsPage(1);
        setCurrentHistoryPage(1);
    };

    const saveToLocalStorage = (data: McLogEntry) => {
        const storedData = JSON.parse(localStorage.getItem(`${uuid}_mclogs`) || '[]');
        storedData.push(data);
        localStorage.setItem(`${uuid}_mclogs`, JSON.stringify(storedData));
    };

    const loadFromLocalStorage = () => {
        const storedData: McLogEntry[] = JSON.parse(localStorage.getItem(`${uuid}_mclogs`) || '[]');
        setMclogsUrls(storedData);
    };

    const removeFromLocalStorage = (id: string) => {
        const storedData: McLogEntry[] = JSON.parse(localStorage.getItem(`${uuid}_mclogs`) || '[]');
        const updatedData = storedData.filter((entry) => entry.id !== id);
        localStorage.setItem(`${uuid}_mclogs`, JSON.stringify(updatedData));
        setMclogsUrls(updatedData);
    };

    const clearAllLogs = () => {
        localStorage.removeItem(`${uuid}_mclogs`);
        setMclogsUrls([]);
        setShowModal(false);
    };

    const fetchLogs = async () => {
        clearFlashes('logs');
        setLoading(true);
        try {
            const response = await axios.get(`/api/client/servers/${uuid}/files/list?directory=/logs`, {
                headers: { 'X-CSRF-TOKEN': csrfToken ?? '' },
            });

            const files = response.data.data.map((file: { attributes: { name: string } }) => file.attributes.name);
            setLogs(files);
        } catch (error) {
            console.error('Error fetching logs:', error);
            addError({ key: 'logs', message: 'Failed to fetch logs. Please try again later.' });
        } finally {
            setLoading(false);
        }
    };

    const fetchMclogsData = async (id: string) => {
        clearFlashes('logs');
        setLoading(true);
        try {
            const rawResponse = await axios.get(`https://api.mclo.gs/1/raw/${id}`);
            const insightsResponse = await axios.get(`https://api.mclo.gs/1/insights/${id}`);

            setSelectedLogData(rawResponse.data);
            setInsightsData(insightsResponse.data);
        } catch (error) {
            console.error('Error fetching MCLogs data:', error);
            addError({ key: 'logs', message: 'Failed to fetch MCLogs data. Please try again later.' });
        } finally {
            setLoading(false);
        }
    };

    const handleUploadToMclogs = async (fileName: string) => {
        clearFlashes('logs');
        setLoading(true);

        try {
            let logData: string;

            if (fileName.endsWith('.gz')) {
                const decompressResponse = await axios.post(
                    `/api/client/servers/${uuid}/files/decompress`,
                    { root: '/logs', file: fileName },
                    { headers: { 'X-CSRF-TOKEN': csrfToken ?? '' } }
                );

                if (decompressResponse.status === 204) {
                    const decompressedFileName = fileName.replace('.gz', '');

                    const fileContentResponse = await axios.get(
                        `/api/client/servers/${uuid}/files/contents?file=/logs/${decompressedFileName}`,
                        { headers: { 'X-CSRF-TOKEN': csrfToken ?? '' } }
                    );

                    logData = fileContentResponse.data;

                    await axios.post(
                        `/api/client/servers/${uuid}/files/delete`,
                        { root: '/logs', files: [decompressedFileName] },
                        { headers: { 'X-CSRF-TOKEN': csrfToken ?? '' } }
                    );
                } else {
                    throw new Error('Failed to decompress the file.');
                }
            } else {
                const fileContentResponse = await axios.get(
                    `/api/client/servers/${uuid}/files/contents?file=/logs/${fileName}`,
                    { headers: { 'X-CSRF-TOKEN': csrfToken ?? '' } }
                );

                logData = fileContentResponse.data;
            }

            const formData = new URLSearchParams();
            formData.append('content', `// Log file: ${fileName}\n\n${logData}`);

            const uploadResponse = await axios.post('https://api.mclo.gs/1/log', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            if (uploadResponse.data.success && uploadResponse.data.url) {
                const newLog = {
                    id: uploadResponse.data.id,
                    url: uploadResponse.data.url,
                    uploadedAt: new Date().toISOString(),
                };
                setMclogsUrls((prev) => [newLog, ...prev]);
                saveToLocalStorage(newLog);

                await fetchMclogsData(uploadResponse.data.id);
            } else {
                addError({ key: 'logs', message: 'Failed to upload logs to MCLogs.' });
            }
        } catch (error) {
            console.error('Error uploading logs:', error);
            addError({ key: 'logs', message: 'An error occurred while uploading logs. Please try again later.' });
        } finally {
            setLoading(false);
        }
    };

    const getServerImageUrl = (serverName: string) => {
        const nameToImageMapping: Record<string, string> = {
            Arclight: '/extensions/mclogs/versions/arclight.png',
            BungeeCord: '/extensions/mclogs/versions/bungeecord.png',
            Canvas: '/extensions/mclogs/versions/canvas.png',
            Fabric: '/extensions/mclogs/versions/fabric.png',
            Folia: '/extensions/mclogs/versions/folia.png',
            Forge: '/extensions/mclogs/versions/forge.png',
            Leaves: '/extensions/mclogs/versions/leaves.png',
            Mohist: '/extensions/mclogs/versions/mohist.png',
            NeoForge: '/extensions/mclogs/versions/neoforge.png',
            Paper: '/extensions/mclogs/versions/paper.png',
            Pufferfish: '/extensions/mclogs/versions/pufferfish.png',
            Purpur: '/extensions/mclogs/versions/purpur.png',
            Quilt: '/extensions/mclogs/versions/quilt.png',
            Sponge: '/extensions/mclogs/versions/sponge.png',
            Vanilla: '/extensions/mclogs/versions/vanilla.png',
            Velocity: '/extensions/mclogs/versions/velocity.png',
            Waterfall: '/extensions/mclogs/versions/waterfall.png',
        };
        return nameToImageMapping[serverName] || '/extensions/mclogs/versions/vanilla.png';
    };

    useEffect(() => {
        fetchLogs();
        loadFromLocalStorage();
    }, []);

    useEffect(() => {
        setMclogsUrls((prev) => {
            const sorted = [...prev].sort((a, b) => {
                const aTime = new Date(a.uploadedAt).getTime();
                const bTime = new Date(b.uploadedAt).getTime();
                return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
            });
            return sorted;
        });
    }, [sortOrder]);

    const renderPaginationControls = (
        currentPage: number,
        totalPages: number,
        onPageChange: (page: number) => void
    ) => {
        if (totalPages <= 1) return null;

        let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
        let endPage = startPage + maxPageButtons - 1;

        if (endPage > totalPages) {
            endPage = totalPages;
            startPage = Math.max(1, endPage - maxPageButtons + 1);
        }

        const pageNumbers = [];
        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i);
        }

        return (
            <div css={tw`flex justify-center items-center mt-4 gap-1`}>
                {currentPage > 1 && (
                    <>
                        <Button size='xsmall' isSecondary onClick={() => onPageChange(1)}>
                            First
                        </Button>
                        <Button size='xsmall' isSecondary onClick={() => onPageChange(currentPage - 1)}>
                            Prev
                        </Button>
                    </>
                )}
                {pageNumbers.map((page) => (
                    <Button
                        key={page}
                        size='xsmall'
                        color={currentPage === page ? 'primary' : undefined}
                        isSecondary={currentPage !== page}
                        onClick={() => onPageChange(page)}
                    >
                        {page}
                    </Button>
                ))}
                {currentPage < totalPages && (
                    <>
                        <Button size='xsmall' isSecondary onClick={() => onPageChange(currentPage + 1)}>
                            Next
                        </Button>
                        <Button size='xsmall' isSecondary onClick={() => onPageChange(totalPages)}>
                            Last
                        </Button>
                    </>
                )}
            </div>
        );
    };

    if (loading) {
        return <Spinner size={'large'} centered />;
    }

    return (
        <ServerContentBlock title={'Logs'}>
            <FlashMessageRender byKey={'logs'} css={tw`mb-4`} />
            <div css={tw`p-6 bg-neutral-800 rounded`}>
                <div css={tw`flex items-center justify-between mb-4`}>
                    <h3 css={tw`text-2xl text-neutral-100`}>Available Logs</h3>
                    <div css={tw`flex items-center gap-2`}>
                        <select
                            css={tw`bg-neutral-700 text-neutral-200 px-3 py-2 rounded text-sm border border-neutral-600`}
                            value={logsPerPage}
                            onChange={(e) => handleLogsPerPageChange(Number(e.target.value))}
                        >
                            <option value={5}>5 per page</option>
                            <option value={10}>10 per page</option>
                            <option value={15}>15 per page</option>
                            <option value={20}>20 per page</option>
                        </select>
                        <select
                            css={tw`bg-neutral-700 text-neutral-200 px-3 py-2 rounded text-sm border border-neutral-600`}
                            value={logSortOrder}
                            onChange={(e) => setLogSortOrder(e.target.value as 'newest' | 'oldest')}
                        >
                            <option value='newest'>Newest to Oldest</option>
                            <option value='oldest'>Oldest to Newest</option>
                        </select>
                    </div>
                </div>
                {!sortedLogs.length ? (
                    <p css={tw`text-sm text-neutral-400`}>
                        No logs found in the server directory. Are you running a Minecraft Server?
                    </p>
                ) : (
                    <>
                        <div css={tw`divide-y divide-neutral-700`}>
                            {paginatedLogs.map((logFile) => (
                                <div key={logFile} css={tw`flex items-center justify-between py-3`}>
                                    <span css={tw`text-sm text-neutral-300`}>{logFile}</span>
                                    <Button size='small' onClick={() => handleUploadToMclogs(logFile)}>
                                        Upload to MCLogs
                                    </Button>
                                </div>
                            ))}
                        </div>
                        {renderPaginationControls(currentLogsPage, totalLogsPages, handleLogsPageChange)}
                    </>
                )}
            </div>

            <div css={tw`mt-6`}>
                <Button isSecondary onClick={() => setHistoryVisible(!historyVisible)}>
                    {historyVisible ? 'Hide MCLogs History' : 'Show MCLogs History'}
                </Button>
                {historyVisible && (
                    <div css={tw`p-6 bg-neutral-800 rounded mt-4`}>
                        <div css={tw`flex items-center justify-between mb-4`}>
                            <h3 css={tw`text-2xl text-neutral-100`}>MCLogs History</h3>
                            <div css={tw`flex items-center gap-2`}>
                                <Button color='red' size='small' onClick={() => setShowModal(true)}>
                                    Delete All History
                                </Button>
                                <select
                                    css={tw`bg-neutral-700 text-neutral-200 px-3 py-2 rounded text-sm border border-neutral-600`}
                                    value={logsPerPage}
                                    onChange={(e) => handleLogsPerPageChange(Number(e.target.value))}
                                >
                                    <option value={5}>5 per page</option>
                                    <option value={10}>10 per page</option>
                                    <option value={15}>15 per page</option>
                                    <option value={20}>20 per page</option>
                                </select>
                                <select
                                    css={tw`bg-neutral-700 text-neutral-200 px-3 py-2 rounded text-sm border border-neutral-600`}
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                                >
                                    <option value='newest'>Newest to Oldest</option>
                                    <option value='oldest'>Oldest to Newest</option>
                                </select>
                            </div>
                        </div>
                        {!mclogsUrls.length ? (
                            <p css={tw`text-sm text-neutral-400`}>No MCLogs uploads found.</p>
                        ) : (
                            <>
                                <ul css={tw`list-none p-0`}>
                                    {paginatedHistory.map(({ id, url, uploadedAt }) => (
                                        <li
                                            key={id}
                                            css={tw`py-3 flex justify-between items-center border-b border-neutral-700`}
                                        >
                                            <div>
                                                <a
                                                    href={url}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    css={tw`text-sm text-primary-400 hover:text-primary-300`}
                                                >
                                                    {url}
                                                </a>
                                                <span css={tw`block text-xs text-neutral-500 mt-1`}>
                                                    Uploaded on: {new Date(uploadedAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div css={tw`flex gap-2`}>
                                                <CopyOnClick text={url}>
                                                    <Button size='xsmall' isSecondary>
                                                        Copy Link
                                                    </Button>
                                                </CopyOnClick>
                                                <Button size='xsmall' color='green' onClick={() => fetchMclogsData(id)}>
                                                    View Data
                                                </Button>
                                                <Button
                                                    size='xsmall'
                                                    color='red'
                                                    onClick={() => removeFromLocalStorage(id)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                {renderPaginationControls(
                                    currentHistoryPage,
                                    totalHistoryPages,
                                    handleHistoryPageChange
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {showModal && (
                <div css={tw`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50`}>
                    <div css={tw`bg-neutral-800 p-6 rounded text-center max-w-md`}>
                        <h3 css={tw`text-xl text-neutral-100 mb-4`}>Are you sure?</h3>
                        <p css={tw`text-sm text-neutral-400 mb-6`}>
                            This will permanently delete all MCLogs history from local storage.
                        </p>
                        <div css={tw`flex gap-3 justify-center`}>
                            <Button color='red' onClick={clearAllLogs}>
                                Yes, Delete All
                            </Button>
                            <Button isSecondary onClick={() => setShowModal(false)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {insightsData && (
                <div css={tw`p-6 bg-neutral-800 rounded mt-6`}>
                    <div css={tw`flex items-center mb-4`}>
                        <img
                            src={getServerImageUrl(insightsData.name || 'Vanilla')}
                            alt={insightsData.name || 'Unknown'}
                            css={tw`w-16 h-16 mr-4 rounded-full`}
                        />
                        <div>
                            <h3 css={tw`text-2xl text-neutral-100`}>{insightsData.name || 'Unknown Server'}</h3>
                            <p css={tw`text-sm text-neutral-400`}>Version: {insightsData.version || 'Not Available'}</p>
                        </div>
                    </div>

                    {insightsData.analysis?.problems?.length ? (
                        <div css={tw`bg-neutral-900 p-4 rounded`}>
                            <h4 css={tw`text-lg text-neutral-100 mb-3`}>Analysis</h4>
                            {insightsData.analysis.problems.map((problem, index) => (
                                <div key={index} css={tw`mb-4 last:mb-0`}>
                                    <p css={tw`text-sm text-neutral-300 mb-2 font-medium`}>
                                        {problem.message || 'No problem message available.'}
                                    </p>
                                    {problem.solutions?.length ? (
                                        <ul css={tw`list-disc list-inside text-sm text-neutral-400 ml-4`}>
                                            {problem.solutions.map((solution, idx) => (
                                                <li key={idx}>
                                                    {solution.message || 'No solution message available.'}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p css={tw`text-sm text-neutral-500 ml-4`}>No solutions available.</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p css={tw`text-sm text-green-400`}>No problems found in analysis.</p>
                    )}
                </div>
            )}

            {selectedLogData && (
                <div css={tw`mt-6 p-6 bg-neutral-800 rounded`}>
                    <div css={tw`flex justify-between items-center mb-4`}>
                        <h3 css={tw`text-2xl text-neutral-100`}>Selected Log Data</h3>
                        <Button
                            color='red'
                            size='small'
                            onClick={() => {
                                setSelectedLogData(null);
                                setInsightsData(null);
                            }}
                        >
                            Close
                        </Button>
                    </div>
                    <h4 css={tw`text-base text-neutral-300 mb-3`}>Raw Log</h4>
                    <Button
                        size='xsmall'
                        isSecondary
                        css={tw`mb-4`}
                        onClick={() => setShowOriginal((v) => !v)}
                        type='button'
                    >
                        {showOriginal ? 'Show Grouped/Collapsible View' : 'Show Original Log Order'}
                    </Button>
                    <div
                        css={tw`text-sm whitespace-pre-wrap mb-4 max-h-96 overflow-y-auto bg-neutral-900 p-4 rounded font-mono`}
                    >
                        {showOriginal
                            ? selectedLogData.split('\n').map((line, index) => {
                                  let lineStyle = tw`text-neutral-300`;
                                  if (line.includes('WARN')) lineStyle = tw`text-yellow-400`;
                                  else if (line.includes('INFO')) lineStyle = tw`text-cyan-400`;
                                  else if (line.includes('ERROR')) lineStyle = tw`text-red-400`;
                                  return (
                                      <p css={lineStyle} key={index}>
                                          {line}
                                      </p>
                                  );
                              })
                            : (() => {
                                  const grouped: Record<LogSection, string[]> = {
                                      ERROR: [],
                                      WARN: [],
                                      INFO: [],
                                      OTHER: [],
                                  };
                                  selectedLogData.split('\n').forEach((line) => {
                                      if (line.includes('ERROR')) grouped.ERROR.push(line);
                                      else if (line.includes('WARN')) grouped.WARN.push(line);
                                      else if (line.includes('INFO')) grouped.INFO.push(line);
                                      else grouped.OTHER.push(line);
                                  });
                                  const lineStyle: Record<LogSection, any> = {
                                      ERROR: tw`text-red-400`,
                                      WARN: tw`text-yellow-400`,
                                      INFO: tw`text-cyan-400`,
                                      OTHER: tw`text-neutral-300`,
                                  };
                                  return LogSectionNames.map(
                                      (type) =>
                                          grouped[type].length > 0 && (
                                              <div key={type} css={tw`mb-3`}>
                                                  <Button
                                                      size='xsmall'
                                                      isSecondary
                                                      css={tw`mb-2`}
                                                      onClick={() => setCollapsed((c) => ({ ...c, [type]: !c[type] }))}
                                                      type='button'
                                                  >
                                                      {collapsed[type] ? `Show` : `Hide`} {grouped[type].length} {type}{' '}
                                                      line{grouped[type].length !== 1 ? 's' : ''}
                                                  </Button>
                                                  {!collapsed[type] && (
                                                      <div>
                                                          {grouped[type].map((line, idx) => (
                                                              <p css={lineStyle[type]} key={idx}>
                                                                  {line}
                                                              </p>
                                                          ))}
                                                      </div>
                                                  )}
                                              </div>
                                          )
                                  );
                              })()}
                    </div>
                </div>
            )}
        </ServerContentBlock>
    );
};

export default LogsPage;
