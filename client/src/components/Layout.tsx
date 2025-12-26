import { NavLink, Outlet } from 'react-router-dom';
import { Home, GitBranch, Play, Settings, FolderOpen, Database } from 'lucide-react';
import './Layout.css';

export default function Layout() {
    const navItems = [
        { path: '/dashboard', icon: <Home size={20} />, label: '대시보드' },
        { path: '/storage', icon: <FolderOpen size={20} />, label: '스토리지' },
        { path: '/pipes', icon: <GitBranch size={20} />, label: '파이프' },
        { path: '/tables', icon: <Database size={20} />, label: '테이블' },
        { path: '/execute', icon: <Play size={20} />, label: '실행' },
        { path: '/settings', icon: <Settings size={20} />, label: '설정' }
    ];

    return (
        <div className="layout">
            <nav className="sidebar">
                <div className="logo">
                    <GitBranch size={24} />
                    <span>Data Chef</span>
                </div>
                <ul className="nav-list">
                    {navItems.map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
