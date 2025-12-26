import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GitBranch, MoreVertical, Edit, Trash2, RefreshCw } from 'lucide-react';
import { pipesApi, executionApi } from '../api';
import './Pipes.css';

interface Pipe {
    id: string;
    name: string;
    description?: string;
    filePattern: { extensions: string[] };
    updatedAt: string;
}

export default function Pipes() {
    const navigate = useNavigate();
    const [pipes, setPipes] = useState<Pipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [executing, setExecuting] = useState<string | null>(null);

    useEffect(() => {
        loadPipes();
    }, []);

    async function loadPipes() {
        try {
            const data = await pipesApi.list();
            setPipes(data);
        } catch (error) {
            console.error('Failed to load pipes:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('정말 이 파이프를 삭제하시겠습니까? 폴더와 파일도 함께 삭제됩니다.')) return;

        try {
            await pipesApi.delete(id);
            setPipes(pipes.filter((p) => p.id !== id));
        } catch (error) {
            console.error('Failed to delete pipe:', error);
            alert('삭제 실패: ' + (error as Error).message);
        }
    }

    async function handleExecute(id: string) {
        setExecuting(id);
        try {
            const result = await executionApi.execute(id);
            if (result.success) {
                alert('파이프가 성공적으로 실행되었습니다.');
            } else {
                alert('실행 실패: ' + result.error);
            }
        } catch (error) {
            console.error('Failed to execute pipe:', error);
            alert('실행 실패: ' + (error as Error).message);
        } finally {
            setExecuting(null);
        }
    }

    return (
        <div className="pipes-container">
            <header className="pipes-header">
                <div>
                    <h1>파이프 관리</h1>
                    <p>데이터 처리 파이프라인을 생성하고 관리하세요</p>
                </div>
                <button className="primary-button" onClick={() => navigate('/pipes/new')}>
                    <Plus size={18} />
                    새 파이프 생성
                </button>
            </header>

            {loading ? (
                <div className="loading">로딩 중...</div>
            ) : pipes.length === 0 ? (
                <div className="empty-state">
                    <GitBranch size={64} />
                    <h3>아직 파이프가 없습니다</h3>
                    <p>파이프는 재사용 가능한 데이터 처리 템플릿입니다.</p>
                    <button className="primary-button" onClick={() => navigate('/pipes/new')}>
                        <Plus size={18} />
                        첫 파이프 만들기
                    </button>
                </div>
            ) : (
                <div className="pipes-grid">
                    {pipes.map((pipe) => (
                        <div key={pipe.id} className="pipe-card">
                            <div className="card-header">
                                <div className="card-icon">
                                    <GitBranch size={24} />
                                </div>
                                <div className="card-menu">
                                    <button
                                        className="menu-button"
                                        onClick={() => setMenuOpen(menuOpen === pipe.id ? null : pipe.id)}
                                    >
                                        <MoreVertical size={18} />
                                    </button>
                                    {menuOpen === pipe.id && (
                                        <div className="menu-dropdown">
                                            <button onClick={() => navigate(`/pipes/${pipe.id}`)}>
                                                <Edit size={16} /> 수정
                                            </button>
                                            <button onClick={() => { setMenuOpen(null); handleExecute(pipe.id); }}>
                                                <RefreshCw size={16} /> 재실행
                                            </button>
                                            <button className="danger" onClick={() => handleDelete(pipe.id)}>
                                                <Trash2 size={16} /> 삭제
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h3>{pipe.name}</h3>
                            <p className="description">{pipe.description || '설명 없음'}</p>

                            <div className="tags">
                                {pipe.filePattern.extensions.map((ext) => (
                                    <span key={ext} className="tag">.{ext}</span>
                                ))}
                            </div>

                            <div className="card-footer">
                                <span className="meta">
                                    {new Date(pipe.updatedAt).toLocaleDateString('ko-KR')}
                                </span>
                                <button
                                    className="run-button"
                                    onClick={() => handleExecute(pipe.id)}
                                    disabled={executing === pipe.id}
                                >
                                    <RefreshCw size={16} /> {executing === pipe.id ? '실행 중...' : '재실행'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
