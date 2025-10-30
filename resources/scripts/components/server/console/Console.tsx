import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ITerminalOptions, Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { SearchBarAddon } from 'xterm-addon-search-bar';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { ScrollDownHelperAddon } from '@/plugins/XtermScrollDownHelperAddon';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { ServerContext } from '@/state/server';
import { usePermissions } from '@/plugins/usePermissions';
import { theme as th } from 'twin.macro';
import useEventListener from '@/plugins/useEventListener';
import { debounce } from 'debounce';
import { usePersistedState } from '@/plugins/usePersistedState';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import classNames from 'classnames';
import { ChevronDoubleRightIcon } from '@heroicons/react/solid';

import 'xterm/css/xterm.css';
import styles from './style.module.css';

const theme = {
    background: 'hsl(0, 0%, 7%)',
    cursor: 'transparent',
    black: 'hsl(0, 0%, 7%)',
    red: '#E54B4B',
    green: '#9ECE58',
    yellow: '#FAED70',
    blue: '#396FE2',
    magenta: '#BB80B3',
    cyan: '#2DDAFD',
    white: '#d0d0d0',
    brightBlack: 'rgba(255, 255, 255, 0.2)',
    brightRed: '#FF5370',
    brightGreen: '#C3E88D',
    brightYellow: '#FFCB6B',
    brightBlue: '#82AAFF',
    brightMagenta: '#C792EA',
    brightCyan: '#89DDFF',
    brightWhite: '#ffffff',
    selection: '#FAF089',
};

const terminalProps: ITerminalOptions = {
    disableStdin: true,
    cursorStyle: 'underline',
    allowTransparency: true,
    fontSize: 12,
    fontFamily: th('fontFamily.mono'),
    rows: 30,
    theme: theme,
};

const MAX_LOG_LINES = 800;
const MOBILE_PRELUDE = 'container@pterodactyl~ ';
const ANSI_ESCAPE_PREFIX = String.fromCharCode(27);
const ANSI_ESCAPE_PATTERN = new RegExp(`${ANSI_ESCAPE_PREFIX}\\[[0-9;]*[A-Za-z]`, 'g');

const stripAnsiCodes = (value: string) => value.replace(ANSI_ESCAPE_PATTERN, '');

const useIsTouchDevice = (): boolean => {
    const [isTouch, setIsTouch] = useState(false);

    useEffect(() => {
        const detect = () => {
            if (typeof window === 'undefined') {
                return false;
            }

            return (
                'ontouchstart' in window ||
                (navigator as any).maxTouchPoints > 0 ||
                (navigator as any).msMaxTouchPoints > 0 ||
                window.matchMedia?.('(pointer: coarse)').matches === true
            );
        };

        setIsTouch(detect());

        const mediaQuery = typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)') : null;
        const handler = () => setIsTouch(detect());
        mediaQuery?.addEventListener?.('change', handler);

        return () => mediaQuery?.removeEventListener?.('change', handler);
    }, []);

    return isTouch;
};

export default () => {
    const TERMINAL_PRELUDE = '\u001b[1m\u001b[33mcontainer@pterodactyl~ \u001b[0m';
    const ref = useRef<HTMLDivElement>(null);
    const mobileLogRef = useRef<HTMLDivElement>(null);
    const [logLines, setLogLines] = useState<string[]>([]);
    const isTouchDevice = useIsTouchDevice();
    const terminal = useMemo<Terminal | null>(() => {
        if (isTouchDevice) {
            return null;
        }

        return new Terminal({ ...terminalProps });
    }, [isTouchDevice]);
    const fitAddon = useMemo(() => (terminal ? new FitAddon() : null), [terminal]);
    const searchAddon = useMemo(() => (terminal ? new SearchAddon() : null), [terminal]);
    const searchBar = useMemo(() => (searchAddon ? new SearchBarAddon({ searchAddon }) : null), [searchAddon]);
    const webLinksAddon = useMemo(() => (terminal ? new WebLinksAddon() : null), [terminal]);
    const scrollDownHelperAddon = useMemo(() => (terminal ? new ScrollDownHelperAddon() : null), [terminal]);
    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);
    const [canSendCommands] = usePermissions(['control.console']);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const [history, setHistory] = usePersistedState<string[]>(`${serverId}:command_history`, []);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const appendConsoleLine = useCallback(
        (line: string, { prelude = false, isError = false }: { prelude?: boolean; isError?: boolean } = {}) => {
            const normalized = line.replace(/(?:\r\n|\r|\n)$/im, '');

            if (terminal && !isTouchDevice) {
                terminal.writeln(`${prelude ? TERMINAL_PRELUDE : ''}${normalized}\u001b[0m`);
            }

            if (isTouchDevice) {
                const stripped = stripAnsiCodes(normalized);
                const prefix = prelude ? MOBILE_PRELUDE : '';
                const message = `${prefix}${isError ? '[ERROR] ' : ''}${stripped}`;

                setLogLines((prev) => {
                    const next = [...prev, message];
                    return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
                });
            }
        },
        [isTouchDevice, setLogLines, terminal, TERMINAL_PRELUDE]
    );

    const handleConsoleOutput = useCallback(
        (line: string, prelude = false) => appendConsoleLine(line, { prelude }),
        [appendConsoleLine]
    );

    const handleTransferStatus = useCallback(
        (status: string) => {
            switch (status) {
                case 'failure':
                    appendConsoleLine('Transfer has failed.', { prelude: true });
                    return;

                case 'archive':
                    appendConsoleLine('Server has been archived successfully, attempting connection to target node..', {
                        prelude: true,
                    });
            }
        },
        [appendConsoleLine]
    );

    const handleDaemonErrorOutput = useCallback(
        (line: string) => appendConsoleLine(line, { prelude: true, isError: true }),
        [appendConsoleLine]
    );

    const handlePowerChangeEvent = useCallback(
        (state: string) => appendConsoleLine('Server marked as ' + state + '...', { prelude: true }),
        [appendConsoleLine]
    );

    const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            const newIndex = Math.min(historyIndex + 1, history!.length - 1);

            setHistoryIndex(newIndex);
            e.currentTarget.value = history![newIndex] || '';

            // By default up arrow will also bring the cursor to the start of the line,
            // so we'll preventDefault to keep it at the end.
            e.preventDefault();
        }

        if (e.key === 'ArrowDown') {
            const newIndex = Math.max(historyIndex - 1, -1);

            setHistoryIndex(newIndex);
            e.currentTarget.value = history![newIndex] || '';
        }

        const command = e.currentTarget.value;
        if (e.key === 'Enter' && command.length > 0) {
            setHistory((prevHistory) => [command, ...prevHistory!].slice(0, 32));
            setHistoryIndex(-1);

            instance && instance.send('send command', command);
            e.currentTarget.value = '';
        }
    };

    useEffect(() => {
        if (!terminal || !ref.current) {
            return;
        }

        if (terminal.element) {
            return;
        }

        if (fitAddon) terminal.loadAddon(fitAddon);
        if (searchAddon) terminal.loadAddon(searchAddon);
        if (searchBar) terminal.loadAddon(searchBar);
        if (webLinksAddon) terminal.loadAddon(webLinksAddon);
        if (scrollDownHelperAddon) terminal.loadAddon(scrollDownHelperAddon);

        terminal.open(ref.current);
        fitAddon?.fit();

        terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                document.execCommand('copy');
                return false;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                searchBar?.show();
                return false;
            }
            if (e.key === 'Escape') {
                searchBar?.hidden();
            }
            return true;
        });
    }, [fitAddon, ref, scrollDownHelperAddon, searchAddon, searchBar, terminal, webLinksAddon]);

    useEventListener(
        'resize',
        debounce(() => {
            if (terminal?.element) {
                fitAddon?.fit();
            }
        }, 100)
    );

    useEffect(() => {
        const listeners: Record<string, (s: string) => void> = {
            [SocketEvent.STATUS]: handlePowerChangeEvent,
            [SocketEvent.CONSOLE_OUTPUT]: handleConsoleOutput,
            [SocketEvent.INSTALL_OUTPUT]: handleConsoleOutput,
            [SocketEvent.TRANSFER_LOGS]: handleConsoleOutput,
            [SocketEvent.TRANSFER_STATUS]: handleTransferStatus,
            [SocketEvent.DAEMON_MESSAGE]: (line) => handleConsoleOutput(line, true),
            [SocketEvent.DAEMON_ERROR]: handleDaemonErrorOutput,
        };

        if (connected && instance) {
            if (!isTransferring) {
                if (terminal && !isTouchDevice) {
                    terminal.clear();
                } else if (isTouchDevice) {
                    setLogLines([]);
                }
            }

            Object.entries(listeners).forEach(([event, listener]) => {
                instance.addListener(event, listener);
            });
            instance.send(SocketRequest.SEND_LOGS);
        }

        return () => {
            if (!instance) {
                return;
            }

            Object.entries(listeners).forEach(([event, listener]) => {
                instance.removeListener(event, listener);
            });
        };
    }, [
        connected,
        handleConsoleOutput,
        handleDaemonErrorOutput,
        handlePowerChangeEvent,
        handleTransferStatus,
        instance,
        isTouchDevice,
        isTransferring,
        setLogLines,
        terminal,
    ]);

    useEffect(() => {
        if (!isTouchDevice || !mobileLogRef.current) {
            return;
        }

        mobileLogRef.current.scrollTop = mobileLogRef.current.scrollHeight;
    }, [isTouchDevice, logLines]);

    return (
        <div className={classNames(styles.terminal, 'relative')}>
            <SpinnerOverlay visible={!connected} size={'large'} />
            <div
                className={classNames(styles.container, styles.overflows_container, { 'rounded-b': !canSendCommands })}
            >
                {isTouchDevice ? (
                    <div ref={mobileLogRef} className={styles.mobile_log}>
                        {logLines.length
                            ? logLines.join('\n')
                            : 'Console output will appear here once the server connects.'}
                    </div>
                ) : (
                    <div className={'h-full'}>
                        <div id={styles.terminal} ref={ref} />
                    </div>
                )}
            </div>
            {canSendCommands && (
                <div className={classNames('relative', styles.overflows_container)}>
                    <input
                        className={classNames('peer', styles.command_input)}
                        type={'text'}
                        placeholder={'Type a command...'}
                        aria-label={'Console command input.'}
                        disabled={!instance || !connected}
                        onKeyDown={handleCommandKeyDown}
                        autoCorrect={'off'}
                        autoCapitalize={'none'}
                    />
                    <div
                        className={classNames(
                            'text-gray-100 peer-focus:text-gray-50 peer-focus:animate-pulse',
                            styles.command_icon
                        )}
                    >
                        <ChevronDoubleRightIcon className={'w-4 h-4'} />
                    </div>
                </div>
            )}
        </div>
    );
};
