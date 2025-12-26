import { useState, useEffect, useCallback } from 'react';
import { storageApi, type StorageItem } from '../api';
import { Folder, FileText, ChevronLeft, Upload, RefreshCw, Trash2, Download, Check } from 'lucide-react';
import './FileBrowser.css';

interface FileBrowserProps {
    initialPath?: string;
    onSelect?: (path: string) => void;
    selectMode?: 'file' | 'folder' | 'both';
}

export default function FileBrowser({ initialPath = '/', onSelect, selectMode = 'folder' }: FileBrowserProps) {
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [items, setItems] = useState<StorageItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<StorageItem | null>(null);

    // 경로 로드
    const loadPath = useCallback(async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await storageApi.list(path);
            // Sort: Folders first, then files
            const sorted = result.items.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'folder' ? -1 : 1;
            });
            setItems(sorted);
            setCurrentPath(result.path);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPath(currentPath);
    }, [currentPath, loadPath]);

    // 아이템 클릭 (선택)
    const handleItemClick = (item: StorageItem) => {
        // If only folders are selectable, ignore file clicks
        if (selectMode === 'folder' && item.type === 'file') return;
        setSelectedItem(item);
    };

    // 아이템 더블 클릭 (이동)
    const handleItemDoubleClick = (item: StorageItem) => {
        if (item.type === 'folder') {
            setCurrentPath(item.path);
            setSelectedItem(null);
        }
    };

    // 상위 폴더로
    const goUp = () => {
        if (currentPath === '/' || currentPath === '') return;
        setCurrentPath('/');
        setSelectedItem(null);
    };

    // 파일 업로드
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            await storageApi.upload(currentPath, Array.from(files));
            loadPath(currentPath);
        } catch (err) {
            alert('업로드 실패: ' + (err as Error).message);
        }
        e.target.value = '';
    };

    // 삭제
    const deleteItem = async (item: StorageItem) => {
        if (!confirm(`"${item.name}" 삭제하시겠습니까?`)) return;

        try {
            await storageApi.delete(item.path, item.type);
            loadPath(currentPath);
            setSelectedItem(null);
        } catch (err) {
            alert('삭제 실패: ' + (err as Error).message);
        }
    };

    // 파일 크기 포맷
    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // 최종 선택 확정
    const handleSelectConfirm = () => {
        if (onSelect) {
            // Priority: Selected Folder Item -> Current Path
            // If in folder mode, and a file is somehow selected (shouldn't be), ignore it?
            // User might have selected a folder inside the list.
            if (selectedItem && selectedItem.type === 'folder') {
                onSelect(selectedItem.path);
            } else {
                // If no folder selected in list, assume current path is the selection
                onSelect(currentPath);
            }
        }
    }

    const isSelectable = (item: StorageItem) => {
        if (selectMode === 'both') return true;
        if (selectMode === 'folder') return item.type === 'folder';
        if (selectMode === 'file') return item.type === 'file';
        return false;
    };

    return (
        <div className="file-browser">
            <div className="browser-header">
                <div className="path-breadcrumbs">
                    <span onClick={() => setCurrentPath('/')} className="path-root hover-effect">Home</span>
                    {currentPath !== '/' && (
                        <div className="breadcrumb-item">
                            <span className="path-separator">/</span>
                            <span className="path-part">{currentPath.split('/').filter(Boolean).join('/')}</span>
                        </div>
                    )}
                </div>
                <div className="header-actions">
                    <button onClick={() => loadPath(currentPath)} title="새로고침">
                        <RefreshCw size={16} />
                    </button>
                    {currentPath !== '/' && currentPath !== '' && (
                        <button onClick={goUp} title="상위 폴더">
                            <ChevronLeft size={16} />
                        </button>
                    )}
                </div>
            </div>

            <div className="browser-toolbar">
                {currentPath !== '/' && currentPath !== '' && (
                    <label className="upload-btn btn-secondary">
                        <Upload size={16} />
                        <span>업로드</span>
                        <input type="file" multiple onChange={handleUpload} hidden />
                    </label>
                )}
            </div>

            {error && <div className="browser-error">{error}</div>}

            <div className="browser-content">
                {loading ? (
                    <div className="browser-loading">
                        <div className="loading-spinner"></div>
                        <p>로딩 중...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="browser-empty">
                        <Folder size={48} className="empty-icon" />
                        <p>빈 폴더입니다</p>
                    </div>
                ) : (
                    <div className="file-list">
                        <div className="file-list-header">
                            <span className="col-name">이름</span>
                            <span className="col-size">크기</span>
                            <span className="col-date">수정일</span>
                            <span className="col-actions"></span>
                        </div>
                        {items.map(item => {
                            const selectable = isSelectable(item);
                            const isSelected = selectedItem?.path === item.path;
                            return (
                                <div
                                    key={item.path}
                                    className={`file-row ${selectable ? 'selectable' : 'disabled'} ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleItemClick(item)}
                                    onDoubleClick={() => handleItemDoubleClick(item)}
                                >
                                    <div className="col-name">
                                        <span className="item-icon">
                                            {item.type === 'folder' ?
                                                <Folder className="folder-icon" size={18} fill="currentColor" /> :
                                                <FileText className="file-icon" size={18} />
                                            }
                                        </span>
                                        <span className="name-text">{item.name}</span>
                                    </div>
                                    <div className="col-size">{item.type === 'folder' ? '-' : formatSize(item.size)}</div>
                                    <div className="col-date">{item.lastModified?.split('T')[0] || '-'}</div>
                                    <div className="col-actions">
                                        {item.type === 'file' && (
                                            <a
                                                href={storageApi.getDownloadUrl(item.path)}
                                                onClick={e => e.stopPropagation()}
                                                title="다운로드"
                                                className="action-icon"
                                            >
                                                <Download size={16} />
                                            </a>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteItem(item); }}
                                            title="삭제"
                                            className="action-icon"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {onSelect && (
                <div className="browser-footer">
                    <div className="selected-info">
                        {/* Logic: If folder selected in list -> use that. Else use current path. */}
                        {selectedItem && selectedItem.type === 'folder' ? (
                            <span><Folder size={14} style={{ display: 'inline', marginRight: 4 }} /> {selectedItem.name}</span>
                        ) : (
                            <span><Folder size={14} style={{ display: 'inline', marginRight: 4 }} /> 현 위치: {currentPath === '/' ? 'Home' : currentPath.split('/').pop()}</span>
                        )}
                    </div>
                    <button
                        className="select-button-primary"
                        onClick={handleSelectConfirm}
                    >
                        <Check size={16} />
                        선택
                    </button>
                </div>
            )}
        </div>
    );
}
