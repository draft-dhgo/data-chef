import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, FolderOpen, Terminal, CheckCircle, XCircle, Loader, X } from 'lucide-react';
import { pipesApi, executionApi } from '../api';
import FileBrowser from '../components/FileBrowser';
import './Execute.css';

interface Pipe {
    id: string;
    name: string;
    description?: string;
}

interface Log {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
}

export default function Execute() {
    const [searchParams] = useSearchParams();
    const [pipes, setPipes] = useState<Pipe[]>([]);
    const [selectedPipeId, setSelectedPipeId] = useState<string>('');
    const [sourcePath, setSourcePath] = useState<string>('');
    const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [logs, setLogs] = useState<Log[]>([]);
    const [showBrowser, setShowBrowser] = useState(false);

    useEffect(() => {
        pipesApi.list().then(setPipes).catch(console.error);
        const pipeId = searchParams.get('pipeId');
        if (pipeId) setSelectedPipeId(pipeId);

        const path = searchParams.get('path');
        if (path) setSourcePath(path);
    }, [searchParams]);

    async function handleExecute() {
        if (!selectedPipeId || !sourcePath) {
            alert('파이프와 소스 경로를 선택해주세요.');
            return;
        }

        setStatus('running');
        setLogs([]);

        try {
            const result = await executionApi.execute(selectedPipeId, sourcePath);
            if (result.success) {
                setStatus('success');
            } else {
                setStatus('error');
            }
            if (result.logs) {
                setLogs(result.logs);
            }
        } catch (error) {
            setStatus('error');
            setLogs([{ timestamp: new Date().toISOString(), level: 'error', message: String(error) }]);
        }
    }

    const handlePathSelect = (path: string) => {
        setSourcePath(path);
        setShowBrowser(false);
    };

    return (
        <div className="execute-container">
            <header className="execute-header">
                <h1>파이프 실행</h1>
                <p>파이프를 선택하고 소스 데이터를 처리하세요</p>
            </header>

            <div className="execute-form">
                <div className="form-group">
                    <label>파이프 선택</label>
                    <select
                        value={selectedPipeId}
                        onChange={(e) => setSelectedPipeId(e.target.value)}
                        disabled={status === 'running'}
                    >
                        <option value="">파이프를 선택하세요</option>
                        {pipes.map((pipe) => (
                            <option key={pipe.id} value={pipe.id}>
                                {pipe.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>소스 경로</label>
                    <div className="path-input">
                        <input
                            type="text"
                            value={sourcePath}
                            onChange={(e) => setSourcePath(e.target.value)}
                            placeholder="/path/to/source/data"
                            disabled={status === 'running'}
                        />
                        <button
                            className="browse-button"
                            disabled={status === 'running'}
                            onClick={() => setShowBrowser(true)}
                        >
                            <FolderOpen size={18} />
                        </button>
                    </div>
                </div>

                <button
                    className={`execute-button ${status === 'running' ? 'running' : ''}`}
                    onClick={handleExecute}
                    disabled={status === 'running' || !selectedPipeId || !sourcePath}
                >
                    {status === 'running' ? (
                        <>
                            <Loader size={18} className="spinner" />
                            실행 중...
                        </>
                    ) : (
                        <>
                            <Play size={18} />
                            실행
                        </>
                    )}
                </button>
            </div>

            {(logs.length > 0 || status !== 'idle') && (
                <div className="execution-result">
                    <div className="result-header">
                        <Terminal size={20} />
                        <span>실행 로그</span>
                        {status === 'success' && <CheckCircle size={20} className="success" />}
                        {status === 'error' && <XCircle size={20} className="error" />}
                    </div>
                    <div className="log-container">
                        {logs.map((log, index) => (
                            <div key={index} className={`log-line ${log.level}`}>
                                <span className="log-time">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span className="log-level">[{log.level.toUpperCase()}]</span>
                                <span className="log-message">{log.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showBrowser && (
                <div className="modal-overlay">
                    <div className="modal-content browser-modal">
                        <div className="modal-header">
                            <h2>폴더 선택</h2>
                            <button onClick={() => setShowBrowser(false)} className="close-button">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <FileBrowser
                                initialPath={sourcePath || '/'}
                                onSelect={handlePathSelect}
                                selectMode="folder"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
