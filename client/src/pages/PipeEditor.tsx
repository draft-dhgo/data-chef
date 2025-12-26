import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { pipesApi } from '../api';
import './PipeEditor.css';

interface Pipe {
    id?: string;
    name: string;
    description: string;
    storagePath: string;
    filePattern: {
        extension: string;
    };
    recordBoundary: {
        type: 'delimited' | 'json' | 'jsonl' | 'text' | 'parquet';
        delimiter?: string;
        hasHeader?: boolean;
        encoding?: string;
        fieldExtraction?: {
            method: 'regex' | 'delimiter';
            fields?: Array<{
                name: string;
                pattern: string;
                group: number;
            }>;
            fieldDelimiter?: string;
        };
    };
    schema: {
        inferFromData: boolean;
        columns: Array<{
            name: string;
            type: string;
            nullable: boolean;
        }>;
    };
    partitioning: {
        enabled: boolean;
        keys: Array<{
            column: string;
            transform: string;
        }>;
    };
    output: {
        tableName: string;
        catalog: string;
        namespace: string;
        writeMode: 'append' | 'overwrite';
    };
}

export default function PipeEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(!!id);
    const [saving, setSaving] = useState(false);
    
    const [pipe, setPipe] = useState<Pipe>({
        name: '',
        description: '',
        storagePath: '',
        filePattern: {
            extension: ''
        },
        recordBoundary: {
            type: 'json',
            encoding: 'utf-8',
            delimiter: ',',
            hasHeader: true
        },
        schema: {
            inferFromData: true,
            columns: []
        },
        partitioning: {
            enabled: false,
            keys: []
        },
        output: {
            tableName: '',
            catalog: 'iceberg_catalog',
            namespace: 'default',
            writeMode: 'overwrite'
        }
    });


    useEffect(() => {
        if (id) {
            loadPipe(id);
        }
    }, [id]);

    async function loadPipe(pipeId: string) {
        try {
            const data = await pipesApi.get(pipeId);
            setPipe(data);
        } catch (error) {
            console.error('Failed to load pipe:', error);
            alert('파이프를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!pipe.name.trim()) {
            alert('파이프 이름을 입력하세요.');
            return;
        }
        if (!pipe.storagePath.trim()) {
            alert('스토리지 경로를 입력하세요.');
            return;
        }
        if (!pipe.storagePath.startsWith('/')) {
            alert('스토리지 경로는 /로 시작해야 합니다.');
            return;
        }
        if (!pipe.filePattern.extension.trim()) {
            alert('파일 확장자를 입력하세요.');
            return;
        }
        if (!pipe.output.tableName.trim()) {
            alert('테이블 이름을 입력하세요.');
            return;
        }

        setSaving(true);
        try {
            if (id) {
                await pipesApi.update(id, pipe);
            } else {
                await pipesApi.create(pipe);
            }
            navigate('/pipes');
        } catch (error) {
            console.error('Failed to save pipe:', error);
            alert('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    }

    function addSchemaColumn() {
        setPipe({
            ...pipe,
            schema: {
                ...pipe.schema,
                columns: [
                    ...pipe.schema.columns,
                    { name: '', type: 'string', nullable: true }
                ]
            }
        });
    }

    function updateSchemaColumn(index: number, field: string, value: any) {
        const newColumns = [...pipe.schema.columns];
        newColumns[index] = { ...newColumns[index], [field]: value };
        setPipe({
            ...pipe,
            schema: {
                ...pipe.schema,
                columns: newColumns
            }
        });
    }

    function removeSchemaColumn(index: number) {
        setPipe({
            ...pipe,
            schema: {
                ...pipe.schema,
                columns: pipe.schema.columns.filter((_, i) => i !== index)
            }
        });
    }

    function addPartitionKey() {
        setPipe({
            ...pipe,
            partitioning: {
                ...pipe.partitioning,
                keys: [
                    ...pipe.partitioning.keys,
                    { column: '', transform: 'identity' }
                ]
            }
        });
    }

    function updatePartitionKey(index: number, field: string, value: string) {
        const newKeys = [...pipe.partitioning.keys];
        newKeys[index] = { ...newKeys[index], [field]: value };
        setPipe({
            ...pipe,
            partitioning: {
                ...pipe.partitioning,
                keys: newKeys
            }
        });
    }

    function removePartitionKey(index: number) {
        setPipe({
            ...pipe,
            partitioning: {
                ...pipe.partitioning,
                keys: pipe.partitioning.keys.filter((_, i) => i !== index)
            }
        });
    }

    if (loading) {
        return <div className="pipe-editor-loading">로딩 중...</div>;
    }

    return (
        <div className="pipe-editor">
            <header className="editor-header">
                <button className="back-button" onClick={() => navigate('/pipes')}>
                    <ArrowLeft size={20} />
                </button>
                <h1>{id ? '파이프 수정' : '새 파이프 생성'}</h1>
                <button className="save-button" onClick={handleSave} disabled={saving}>
                    <Save size={18} />
                    {saving ? '저장 중...' : '저장'}
                </button>
            </header>

            <div className="editor-content">
                <section className="editor-section">
                    <h2>기본 정보</h2>
                    <div className="form-group">
                        <label>파이프 이름</label>
                        <input
                            type="text"
                            value={pipe.name}
                            onChange={(e) => setPipe({ ...pipe, name: e.target.value })}
                            placeholder="예: 로그 파일 처리기"
                        />
                    </div>
                    <div className="form-group">
                        <label>설명</label>
                        <textarea
                            value={pipe.description}
                            onChange={(e) => setPipe({ ...pipe, description: e.target.value })}
                            placeholder="파이프에 대한 설명을 입력하세요"
                            rows={3}
                        />
                    </div>
                    <div className="form-group">
                        <label>스토리지 경로</label>
                        <input
                            type="text"
                            value={pipe.storagePath}
                            onChange={(e) => setPipe({ ...pipe, storagePath: e.target.value })}
                            placeholder="예: /logs"
                            disabled={!!id}
                        />
                        <small style={{ color: '#888', fontSize: '0.85em' }}>
                            {id ? '생성 후에는 경로를 변경할 수 없습니다.' : '/ 로 시작하는 폴더 경로를 입력하세요. 파이프 생성 시 자동으로 폴더가 생성됩니다.'}
                        </small>
                    </div>
                </section>

                <section className="editor-section">
                    <h2>파일 패턴</h2>
                    <div className="form-group">
                        <label>파일 확장자</label>
                        <select
                            value={pipe.filePattern.extension}
                            onChange={(e) => setPipe({
                                ...pipe,
                                filePattern: { extension: e.target.value }
                            })}
                        >
                            <option value="">선택하세요</option>
                            <option value="json">json - JSON 파일</option>
                            <option value="csv">csv - CSV 파일</option>
                            <option value="tsv">tsv - TSV 파일</option>
                            <option value="parquet">parquet - Parquet 파일</option>
                            <option value="log">log - 로그 파일</option>
                            <option value="txt">txt - 텍스트 파일</option>
                        </select>
                    </div>
                </section>

                <section className="editor-section">
                    <h2>레코드 경계</h2>
                    <div className="form-group">
                        <label>파일 형식</label>
                        <select
                            value={pipe.recordBoundary.type}
                            onChange={(e) => setPipe({
                                ...pipe,
                                recordBoundary: {
                                    ...pipe.recordBoundary,
                                    type: e.target.value as any
                                }
                            })}
                        >
                            <option value="json">JSON</option>
                            <option value="jsonl">JSON Lines</option>
                            <option value="delimited">구분자 (CSV/TSV)</option>
                            <option value="text">텍스트 (regex 파싱)</option>
                            <option value="parquet">Parquet</option>
                        </select>
                    </div>

                    {pipe.recordBoundary.type === 'delimited' && (
                        <>
                            <div className="form-group">
                                <label>구분자</label>
                                <input
                                    type="text"
                                    value={pipe.recordBoundary.delimiter || ','}
                                    onChange={(e) => setPipe({
                                        ...pipe,
                                        recordBoundary: { ...pipe.recordBoundary, delimiter: e.target.value }
                                    })}
                                    placeholder=","
                                />
                            </div>
                            <div className="form-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={pipe.recordBoundary.hasHeader || false}
                                        onChange={(e) => setPipe({
                                            ...pipe,
                                            recordBoundary: { ...pipe.recordBoundary, hasHeader: e.target.checked }
                                        })}
                                    />
                                    첫 줄을 헤더로 사용
                                </label>
                            </div>
                        </>
                    )}

                    {pipe.recordBoundary.type === 'text' && (
                        <>
                            <div className="form-group">
                                <label>
                                    정규표현식 필드 추출
                                    <small style={{display: 'block', marginTop: '4px', fontWeight: 'normal'}}>
                                        각 필드마다 개별 패턴을 지정하세요
                                    </small>
                                </label>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                                    {(pipe.recordBoundary.fieldExtraction?.fields || []).map((field, idx) => (
                                        <div key={idx} style={{display: 'grid', gridTemplateColumns: '150px 1fr 70px 40px', gap: '8px', alignItems: 'start', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '4px', backgroundColor: '#f9f9f9'}}>
                                            <div>
                                                <input
                                                    type="text"
                                                    placeholder="필드명"
                                                    value={field.name}
                                                    onChange={(e) => {
                                                        const newFields = [...(pipe.recordBoundary.fieldExtraction?.fields || [])];
                                                        newFields[idx] = { ...newFields[idx], name: e.target.value };
                                                        setPipe({
                                                            ...pipe,
                                                            recordBoundary: {
                                                                ...pipe.recordBoundary,
                                                                fieldExtraction: {
                                                                    method: 'regex',
                                                                    fields: newFields
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    style={{width: '100%', padding: '8px'}}
                                                />
                                                <small style={{fontSize: '11px', color: '#666'}}>예: timestamp</small>
                                            </div>
                                            <div>
                                                <input
                                                    type="text"
                                                    placeholder="정규표현식"
                                                    value={field.pattern}
                                                    onChange={(e) => {
                                                        const newFields = [...(pipe.recordBoundary.fieldExtraction?.fields || [])];
                                                        newFields[idx] = { ...newFields[idx], pattern: e.target.value };
                                                        setPipe({
                                                            ...pipe,
                                                            recordBoundary: {
                                                                ...pipe.recordBoundary,
                                                                fieldExtraction: {
                                                                    method: 'regex',
                                                                    fields: newFields
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    style={{width: '100%', padding: '8px'}}
                                                />
                                                <small style={{fontSize: '11px', color: '#666'}}>예: ^(\d{'{'}4{'}'}-\d{'{'}2{'}'}-\d{'{'}2{'}'})</small>
                                            </div>
                                            <div>
                                                <input
                                                    type="number"
                                                    placeholder="그룹"
                                                    value={field.group}
                                                    onChange={(e) => {
                                                        const newFields = [...(pipe.recordBoundary.fieldExtraction?.fields || [])];
                                                        newFields[idx] = { ...newFields[idx], group: parseInt(e.target.value) || 1 };
                                                        setPipe({
                                                            ...pipe,
                                                            recordBoundary: {
                                                                ...pipe.recordBoundary,
                                                                fieldExtraction: {
                                                                    method: 'regex',
                                                                    fields: newFields
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    min="1"
                                                    style={{width: '100%', padding: '8px'}}
                                                />
                                                <small style={{fontSize: '11px', color: '#666'}}>캡처 그룹</small>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newFields = (pipe.recordBoundary.fieldExtraction?.fields || []).filter((_, i) => i !== idx);
                                                    setPipe({
                                                        ...pipe,
                                                        recordBoundary: {
                                                            ...pipe.recordBoundary,
                                                            fieldExtraction: {
                                                                method: 'regex',
                                                                fields: newFields
                                                            }
                                                        }
                                                    });
                                                }}
                                                style={{padding: '8px', cursor: 'pointer', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '4px'}}
                                                title="삭제"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            const newFields = [...(pipe.recordBoundary.fieldExtraction?.fields || []), { name: '', pattern: '', group: 1 }];
                                            setPipe({
                                                ...pipe,
                                                recordBoundary: {
                                                    ...pipe.recordBoundary,
                                                    fieldExtraction: {
                                                        method: 'regex',
                                                        fields: newFields
                                                    }
                                                }
                                            });
                                        }}
                                        type="button"
                                        style={{padding: '10px 16px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px'}}
                                    >
                                        + 필드 추가
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label>인코딩</label>
                        <select
                            value={pipe.recordBoundary.encoding || 'utf-8'}
                            onChange={(e) => setPipe({
                                ...pipe,
                                recordBoundary: { ...pipe.recordBoundary, encoding: e.target.value }
                            })}
                        >
                            <option value="utf-8">UTF-8</option>
                            <option value="euc-kr">EUC-KR</option>
                            <option value="cp949">CP949</option>
                            <option value="ascii">ASCII</option>
                        </select>
                    </div>
                </section>

                <section className="editor-section">
                    <h2>스키마</h2>
                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={pipe.schema.inferFromData}
                                onChange={(e) => setPipe({
                                    ...pipe,
                                    schema: { ...pipe.schema, inferFromData: e.target.checked }
                                })}
                            />
                            데이터에서 스키마 자동 추론
                        </label>
                    </div>

                    {!pipe.schema.inferFromData && (
                        <>
                            <div className="schema-columns">
                                {pipe.schema.columns.map((col, index) => (
                                    <div key={index} className="schema-column">
                                        <input
                                            type="text"
                                            value={col.name}
                                            onChange={(e) => updateSchemaColumn(index, 'name', e.target.value)}
                                            placeholder="컬럼 이름"
                                        />
                                        <select
                                            value={col.type}
                                            onChange={(e) => updateSchemaColumn(index, 'type', e.target.value)}
                                        >
                                            <option value="string">String</option>
                                            <option value="int">Integer</option>
                                            <option value="long">Long</option>
                                            <option value="double">Double</option>
                                            <option value="boolean">Boolean</option>
                                            <option value="timestamp">Timestamp</option>
                                            <option value="date">Date</option>
                                        </select>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={col.nullable}
                                                onChange={(e) => updateSchemaColumn(index, 'nullable', e.target.checked)}
                                            />
                                            Nullable
                                        </label>
                                        <button onClick={() => removeSchemaColumn(index)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button className="add-button" onClick={addSchemaColumn}>
                                <Plus size={16} /> 컬럼 추가
                            </button>
                        </>
                    )}
                </section>

                <section className="editor-section">
                    <h2>파티셔닝</h2>
                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={pipe.partitioning.enabled}
                                onChange={(e) => setPipe({
                                    ...pipe,
                                    partitioning: { ...pipe.partitioning, enabled: e.target.checked }
                                })}
                            />
                            파티셔닝 사용
                        </label>
                    </div>

                    {pipe.partitioning.enabled && (
                        <>
                            <div className="partition-keys">
                                {pipe.partitioning.keys.map((key, index) => (
                                    <div key={index} className="partition-key">
                                        <input
                                            type="text"
                                            value={key.column}
                                            onChange={(e) => updatePartitionKey(index, 'column', e.target.value)}
                                            placeholder="컬럼 이름"
                                        />
                                        <select
                                            value={key.transform}
                                            onChange={(e) => updatePartitionKey(index, 'transform', e.target.value)}
                                        >
                                            <option value="identity">Identity</option>
                                            <option value="year">Year</option>
                                            <option value="month">Month</option>
                                            <option value="day">Day</option>
                                            <option value="hour">Hour</option>
                                            <option value="bucket">Bucket</option>
                                        </select>
                                        <button onClick={() => removePartitionKey(index)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button className="add-button" onClick={addPartitionKey}>
                                <Plus size={16} /> 파티션 키 추가
                            </button>
                        </>
                    )}
                </section>

                <section className="editor-section">
                    <h2>출력 설정</h2>
                    <div className="form-group">
                        <label>테이블 이름</label>
                        <input
                            type="text"
                            value={pipe.output.tableName}
                            onChange={(e) => setPipe({
                                ...pipe,
                                output: { ...pipe.output, tableName: e.target.value }
                            })}
                            placeholder="예: processed_logs"
                        />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>카탈로그</label>
                            <input
                                type="text"
                                value={pipe.output.catalog}
                                onChange={(e) => setPipe({
                                    ...pipe,
                                    output: { ...pipe.output, catalog: e.target.value }
                                })}
                            />
                        </div>
                        <div className="form-group">
                            <label>네임스페이스</label>
                            <input
                                type="text"
                                value={pipe.output.namespace}
                                onChange={(e) => setPipe({
                                    ...pipe,
                                    output: { ...pipe.output, namespace: e.target.value }
                                })}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>쓰기 모드</label>
                        <select
                            value={pipe.output.writeMode}
                            onChange={(e) => setPipe({
                                ...pipe,
                                output: { ...pipe.output, writeMode: e.target.value as any }
                            })}
                        >
                            <option value="append">Append (추가)</option>
                            <option value="overwrite">Overwrite (덮어쓰기)</option>
                        </select>
                        <small>Overwrite 모드는 파이프 재실행 시 기존 데이터를 모두 삭제합니다</small>
                    </div>
                </section>
            </div>
        </div>
    );
}
