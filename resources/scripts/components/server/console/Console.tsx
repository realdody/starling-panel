import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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

const MAX_LOG_LINES = 300;
const ANSI_ESCAPE_PREFIX = String.fromCharCode(27);
const ANSI_TOKEN_REGEX = new RegExp(`${ANSI_ESCAPE_PREFIX}\\[([0-9;?]*)([A-Za-z])`, 'g');

const CARRIAGE_RETURN_REGEX = /\r/g;
const BELL_CHARACTER = String.fromCharCode(7);
const BELL_REGEX = new RegExp(BELL_CHARACTER, 'g');

type ConsoleSegment = {
    text: string;
    style?: CSSProperties;
};

type ParsedConsoleLine = {
    id: number;
    segments: ConsoleSegment[];
};

const ANSI_COLOR_MAP: Record<number, string> = {
    30: theme.black,
    31: theme.red,
    32: theme.green,
    33: theme.yellow,
    34: theme.blue,
    35: theme.magenta,
    36: theme.cyan,
    37: theme.white,
    90: theme.brightBlack,
    91: theme.brightRed,
    92: theme.brightGreen,
    93: theme.brightYellow,
    94: theme.brightBlue,
    95: theme.brightMagenta,
    96: theme.brightCyan,
    97: theme.brightWhite,
};

const ANSI_BACKGROUND_MAP: Record<number, string> = {
    40: theme.black,
    41: theme.red,
    42: theme.green,
    43: theme.yellow,
    44: theme.blue,
    45: theme.magenta,
    46: theme.cyan,
    47: theme.white,
    100: theme.brightBlack,
    101: theme.brightRed,
    102: theme.brightGreen,
    103: theme.brightYellow,
    104: theme.brightBlue,
    105: theme.brightMagenta,
    106: theme.brightCyan,
    107: theme.brightWhite,
};

const buildStyle = (
    color?: string,
    fontWeight?: CSSProperties['fontWeight'],
    backgroundColor?: string
): CSSProperties | undefined => {
    if (!color && !fontWeight && !backgroundColor) {
        return undefined;
    }

    return {
        ...(color ? { color } : {}),
        ...(fontWeight ? { fontWeight } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
    };
};

const stylesEqual = (a?: CSSProperties, b?: CSSProperties) => {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.color === b.color && a.fontWeight === b.fontWeight && a.backgroundColor === b.backgroundColor;
};

const mergeSegments = (segments: ConsoleSegment[]): ConsoleSegment[] => {
    const merged: ConsoleSegment[] = [];

    segments.forEach((segment) => {
        if (!segment.text) {
            return;
        }

        const previous = merged[merged.length - 1];
        if (previous && stylesEqual(previous.style, segment.style)) {
            previous.text += segment.text;
        } else {
            merged.push({ text: segment.text, style: segment.style });
        }
    });

    return merged;
};

const parseAnsiSegments = (input: string): ConsoleSegment[] => {
    const cleanInput = input.replace(CARRIAGE_RETURN_REGEX, '').replace(BELL_REGEX, '');
    const segments: ConsoleSegment[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let currentColor: string | undefined;
    let currentWeight: CSSProperties['fontWeight'];
    let currentBackground: string | undefined;

    const tokenRegex = new RegExp(ANSI_TOKEN_REGEX);

    while ((match = tokenRegex.exec(cleanInput))) {
        const [, codeString, command] = match;

        if (match.index > lastIndex) {
            const text = cleanInput.slice(lastIndex, match.index);
            if (text) {
                segments.push({ text, style: buildStyle(currentColor, currentWeight, currentBackground) });
            }
        }

        lastIndex = tokenRegex.lastIndex;

        if (command !== 'm') {
            continue;
        }

        const codes = codeString ? codeString.split(';') : ['0'];
        codes.forEach((codeValue) => {
            if (!codeValue || codeValue.includes('?')) {
                return;
            }

            const code = Number(codeValue);
            if (Number.isNaN(code)) {
                return;
            }

            if (code === 0) {
                currentColor = undefined;
                currentWeight = undefined;
                currentBackground = undefined;
                return;
            }

            if (code === 1) {
                currentWeight = 600;
                return;
            }

            if (code === 22) {
                currentWeight = undefined;
                return;
            }

            if (code === 39) {
                currentColor = undefined;
                return;
            }

            if (code === 49) {
                currentBackground = undefined;
                return;
            }

            const mappedColor = ANSI_COLOR_MAP[code];
            if (mappedColor) {
                currentColor = mappedColor;
                return;
            }

            const mappedBackground = ANSI_BACKGROUND_MAP[code];
            if (mappedBackground) {
                currentBackground = mappedBackground;
            }
        });
    }

    if (lastIndex < cleanInput.length) {
        const text = cleanInput.slice(lastIndex);
        if (text) {
            segments.push({ text, style: buildStyle(currentColor, currentWeight, currentBackground) });
        }
    }

    return mergeSegments(segments);
};

const detectTouchSupport = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    const nav = window.navigator as Navigator & { maxTouchPoints?: number; msMaxTouchPoints?: number };

    return (
        'ontouchstart' in window ||
        (nav.maxTouchPoints ?? 0) > 0 ||
        (nav.msMaxTouchPoints ?? 0) > 0 ||
        window.matchMedia?.('(pointer: coarse)').matches === true
    );
};

const useIsTouchDevice = (): boolean => {
    const [isTouch, setIsTouch] = useState(detectTouchSupport);

    useEffect(() => {
        const mediaQuery = typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)') : null;
        const handler = () => setIsTouch(detectTouchSupport());
        mediaQuery?.addEventListener?.('change', handler);

        return () => mediaQuery?.removeEventListener?.('change', handler);
    }, []);

    return isTouch;
};

export default () => {
    const TERMINAL_PRELUDE = '\u001b[1m\u001b[33mcontainer@pterodactyl~ \u001b[0m';
    const ref = useRef<HTMLDivElement>(null);
    const mobileLogRef = useRef<HTMLDivElement>(null);
    const lineCounter = useRef(0);
    const [logLines, setLogLines] = useState<ParsedConsoleLine[]>([]);
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
        (line: string, { prelude = false, prefix }: { prelude?: boolean; prefix?: string } = {}) => {
            const normalized = line.replace(/(?:\r\n|\r|\n)$/im, '');
            const composed = `${prelude ? TERMINAL_PRELUDE : ''}${prefix ?? ''}${normalized}\u001b[0m`;

            if (terminal && !isTouchDevice) {
                terminal.writeln(composed);
            }

            if (isTouchDevice) {
                const segments = parseAnsiSegments(composed);
                const lineId = lineCounter.current++;

                setLogLines((prev) => {
                    const next = [...prev, { id: lineId, segments: segments.length ? segments : [{ text: ' ' }] }];
                    return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
                });
            }
        },
        [TERMINAL_PRELUDE, isTouchDevice, terminal]
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
        (line: string) => appendConsoleLine(line, { prelude: true, prefix: '\u001b[1m\u001b[41m' }),
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
                    lineCounter.current = 0;
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
                        {logLines.length ? (
                            logLines.map((entry) => (
                                <div key={entry.id} className={styles.mobile_line}>
                                    {entry.segments.map((segment, index) => (
                                        <span key={index} style={segment.style}>
                                            {segment.text}
                                        </span>
                                    ))}
                                </div>
                            ))
                        ) : (
                            <div className={styles.mobile_placeholder}>
                                Console output will appear here once the server connects.
                            </div>
                        )}
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
