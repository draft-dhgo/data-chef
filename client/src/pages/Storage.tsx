/**
 * 스토리지 페이지 - MinIO 파일 탐색기
 */

import FileBrowser from '../components/FileBrowser';

export default function Storage() {
    return (
        <div className="storage-page" style={{ height: 'calc(100vh - 60px)', padding: '20px' }}>
            <h1 style={{ marginBottom: '20px' }}>📂 파일 스토리지</h1>
            <FileBrowser />
        </div>
    );
}
