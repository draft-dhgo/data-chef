import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Play, Settings, TrendingUp } from 'lucide-react';
import { pipesApi } from '../api';
import './Dashboard.css';

export default function Dashboard() {
    const navigate = useNavigate();
    const [pipeCount, setPipeCount] = useState(0);

    useEffect(() => {
        pipesApi.list().then(pipes => setPipeCount(pipes.length)).catch(() => { });
    }, []);

    const cards = [
        {
            icon: <GitBranch size={32} />,
            title: '파이프 관리',
            description: '데이터 처리 파이프라인을 생성하고 관리하세요',
            stat: `${pipeCount}개`,
            statLabel: '등록된 파이프',
            path: '/pipes',
            color: '#667eea'
        },
        {
            icon: <Play size={32} />,
            title: '파이프 실행',
            description: '파이프를 선택하고 데이터를 처리하세요',
            stat: '-',
            statLabel: '최근 실행',
            path: '/execute',
            color: '#22c55e'
        },
        {
            icon: <Settings size={32} />,
            title: '설정',
            description: 'MinIO, Spark 연결 설정을 관리하세요',
            stat: '',
            statLabel: '',
            path: '/settings',
            color: '#f59e0b'
        }
    ];

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h1>Data Chef</h1>
                    <p>데이터 파이프라인 관리 도구</p>
                </div>
                <div className="status-badge">
                    <TrendingUp size={16} />
                    서버 연결됨
                </div>
            </header>

            <div className="dashboard-grid">
                {cards.map((card, index) => (
                    <div
                        key={index}
                        className="dashboard-card"
                        onClick={() => navigate(card.path)}
                        style={{ '--accent-color': card.color } as React.CSSProperties}
                    >
                        <div className="card-icon" style={{ background: card.color }}>
                            {card.icon}
                        </div>
                        <h3>{card.title}</h3>
                        <p>{card.description}</p>
                        {card.stat && (
                            <div className="card-stat">
                                <span className="stat-value">{card.stat}</span>
                                <span className="stat-label">{card.statLabel}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
