import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, RefreshCw } from 'lucide-react';
import './TableDetail.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface TablePreview {
    schema: Array<{ name: string; type: string }>;
    rows: any[];
    rowCount: number;
}

export default function TableDetail() {
    const { tableName } = useParams<{ tableName: string }>();
    const navigate = useNavigate();
    const [preview, setPreview] = useState<TablePreview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (tableName) {
            loadPreview();
        }
    }, [tableName]);

    async function loadPreview() {
        if (!tableName) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const res = await fetch(`${API_BASE}/api/tables/${tableName}`);
            if (!res.ok) throw new Error('Failed to load table data');
            const data = await res.json();
            setPreview(data);
        } catch (error) {
            console.error('Failed to load table:', error);
            setError((error as Error).message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="table-detail-container">
            <header className="table-detail-header">
                <button className="back-button" onClick={() => navigate('/tables')}>
                    <ArrowLeft size={20} />
                    목록으로
                </button>
                <div className="header-content">
                    <div className="header-info">
                        <h1>{tableName}</h1>
                        <span className="namespace">default</span>
                    </div>
                    <button className="refresh-button" onClick={loadPreview} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                        새로고침
                    </button>
                </div>
            </header>

            {loading ? (
                <div className="loading">로딩 중...</div>
            ) : error ? (
                <div className="error-state">
                    <Database size={64} />
                    <h3>테이블을 불러올 수 없습니다</h3>
                    <p>{error}</p>
                    <button onClick={loadPreview}>다시 시도</button>
                </div>
            ) : preview ? (
                <div className="table-detail-content">
                    <section className="schema-section">
                        <h2>스키마</h2>
                        <div className="schema-grid">
                            {preview.schema.map((col, idx) => (
                                <div key={idx} className="schema-card">
                                    <span className="col-name">{col.name}</span>
                                    <span className="col-type">{col.type}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="data-section">
                        <div className="section-header">
                            <h2>데이터</h2>
                            <span className="row-count">{preview.rowCount}행</span>
                        </div>
                        {preview.rowCount > 0 ? (
                            <div className="data-table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            {preview.schema.map((col, idx) => (
                                                <th key={idx}>{col.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.rows.map((row, idx) => (
                                            <tr key={idx}>
                                                {preview.schema.map((col, colIdx) => (
                                                    <td key={colIdx}>
                                                        {row[col.name] !== null && row[col.name] !== undefined
                                                            ? String(row[col.name])
                                                            : '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="no-data">데이터가 없습니다</p>
                        )}
                    </section>
                </div>
            ) : null}
        </div>
    );
}

