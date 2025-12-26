import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, ChevronRight } from 'lucide-react';
import './Tables.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface TableInfo {
    name: string;
    namespace: string;
}

export default function Tables() {
    const navigate = useNavigate();
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTables();
    }, []);

    async function loadTables() {
        try {
            const res = await fetch(`${API_BASE}/api/tables`);
            if (!res.ok) throw new Error('Failed to load tables');
            const data = await res.json();
            setTables(data.tables || []);
        } catch (error) {
            console.error('Failed to load tables:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="tables-container">
            <header className="tables-header">
                <div>
                    <h1>Iceberg 테이블</h1>
                    <p>파이프로 생성된 테이블을 조회하세요</p>
                </div>
            </header>

            {loading ? (
                <div className="loading">로딩 중...</div>
            ) : tables.length === 0 ? (
                <div className="empty-state">
                    <Database size={64} />
                    <h3>아직 테이블이 없습니다</h3>
                    <p>파이프를 실행하여 Iceberg 테이블을 생성하세요.</p>
                </div>
            ) : (
                <div className="tables-grid">
                    {tables.map((table) => (
                        <div 
                            key={table.name} 
                            className="table-card"
                            onClick={() => navigate(`/tables/${table.name}`)}
                        >
                            <div className="table-card-icon">
                                <Database size={32} />
                            </div>
                            <div className="table-card-info">
                                <h3>{table.name}</h3>
                                <span className="namespace">{table.namespace}</span>
                            </div>
                            <div className="table-card-arrow">
                                <ChevronRight size={20} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

