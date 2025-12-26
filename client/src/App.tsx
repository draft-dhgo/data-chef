import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Pipes from './pages/Pipes';
import PipeEditor from './pages/PipeEditor';
import Execute from './pages/Execute';
import Dashboard from './pages/Dashboard';
import Storage from './pages/Storage';
import Tables from './pages/Tables';
import TableDetail from './pages/TableDetail';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="pipes" element={<Pipes />} />
                    <Route path="pipes/new" element={<PipeEditor />} />
                    <Route path="pipes/:id" element={<PipeEditor />} />
                    <Route path="execute" element={<Execute />} />
                    <Route path="storage" element={<Storage />} />
                    <Route path="tables" element={<Tables />} />
                    <Route path="tables/:tableName" element={<TableDetail />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
