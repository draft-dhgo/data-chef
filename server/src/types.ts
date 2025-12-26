// Pipe 인터페이스 - 재사용 가능한 데이터 처리 워크플로우
export interface Pipe {
    id: string;
    name: string;
    description?: string;

    storagePath: string;

    filePattern: FilePattern;

    recordBoundary: RecordBoundary;

    schema: Schema;

    partitioning: Partitioning;

    output: OutputConfig;

    createdAt: string;
    updatedAt: string;
}

export interface FilePattern {
    extensions: string[];      // ['csv', 'json', 'parquet']
    prefix?: string;           // 'log_'
    suffix?: string;           // '_2024'
    regex?: string;            // 고급 정규표현식 패턴
    minSize?: number;          // 최소 파일 크기 (bytes)
    maxSize?: number;          // 최대 파일 크기 (bytes)
}

export interface RecordBoundary {
    type: 'delimited' | 'fixed' | 'json' | 'jsonl' | 'multiline' | 'parquet' | 'text';
    delimiter?: string;        // ','
    quote?: string;            // '"'
    escape?: string;           // '\\'
    hasHeader?: boolean;       // true
    encoding?: string;         // 'utf-8'
    lineSeparator?: string;    // '\n'
    multilinePattern?: string; // 멀티라인 레코드 패턴

    // 필드 추출 설정 (레코드 내에서 필드를 파싱)
    fieldExtraction?: FieldExtraction;
}

// 레코드 내 필드 추출 규칙
export interface FieldExtraction {
    method: 'regex' | 'delimiter' | 'fixed' | 'json_path' | 'split';

    // regex 방식: 정규표현식 캡처 그룹으로 필드 추출
    pattern?: string;          // '(\d{4}-\d{2}-\d{2}) (\w+) \[(\w+)\] (.*)'

    // delimiter 방식: 구분자로 필드 분리
    fieldDelimiter?: string;   // '|' 또는 '\t'

    // fixed 방식: 고정 폭으로 필드 추출
    fixedWidths?: number[];    // [10, 5, 20, 50] - 각 필드의 문자 수

    // split 방식: 여러 개의 구분자로 단계적 분리
    splitSteps?: SplitStep[];

    // 추출될 필드 이름 목록 (순서대로)
    fieldNames: string[];

    // 추출 실패 시 처리
    onError?: 'skip' | 'null' | 'fail';

    // 필드별 후처리 (trim, 타입 변환 등)
    fieldProcessing?: FieldProcessing[];
}

// 단계적 분리 설정
export interface SplitStep {
    delimiter: string;
    index?: number;            // 특정 인덱스만 선택 (없으면 전체)
    keepAll?: boolean;         // 모든 결과를 배열로 유지
}

// 필드별 후처리 설정
export interface FieldProcessing {
    field: string;             // 필드명
    trim?: boolean;            // 공백 제거
    replace?: { from: string; to: string }[];  // 문자열 치환
    regex?: string;            // 추가 정규표현식 적용
    dateFormat?: string;       // 날짜 파싱 포맷
}

export interface Schema {
    inferFromData: boolean;    // 데이터에서 자동 추론
    columns: SchemaColumn[];
}

export interface SchemaColumn {
    name: string;
    type: ColumnType;
    nullable: boolean;
    description?: string;
    format?: string;           // 날짜/시간 포맷 등
}

export type ColumnType =
    | 'string'
    | 'int'
    | 'long'
    | 'float'
    | 'double'
    | 'boolean'
    | 'date'
    | 'timestamp'
    | 'binary'
    | 'decimal';

export interface Partitioning {
    enabled: boolean;
    keys: PartitionKey[];
}

export interface PartitionKey {
    column: string;
    transform: PartitionTransform;
    bucketCount?: number;      // bucket 변환용
    truncateLength?: number;   // truncate 변환용
}

export type PartitionTransform =
    | 'identity'
    | 'bucket'
    | 'truncate'
    | 'year'
    | 'month'
    | 'day'
    | 'hour';

export interface OutputConfig {
    tableName: string;         // 'processed_logs'
    catalog: string;           // 'iceberg_catalog'
    namespace: string;         // 'default'
    writeMode: 'append' | 'overwrite' | 'upsert';
    properties?: Record<string, string>;
}

// 파이프 실행 관련
export interface PipeExecution {
    id: string;
    pipeId: string;
    pipeName: string;
    sourcePath: string;
    status: ExecutionStatus;
    startedAt: string;
    completedAt?: string;
    filesProcessed: number;
    recordsProcessed: number;
    bytesProcessed: number;
    error?: string;
    logs: ExecutionLog[];
}

export type ExecutionStatus =
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface ExecutionLog {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
}

// 파일 정보
export interface FileInfo {
    path: string;
    name: string;
    size: number;
    modifiedAt: string;
    isDirectory: boolean;
}

// 설정 관련
export interface AppConfig {
    app: {
        name: string;
        version: string;
    };
    minio: MinioConfig;
    spark: SparkConfig;
    iceberg: IcebergConfig;
    ui: UIConfig;
}

export interface MinioConfig {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    defaultBucket: string;
}

export interface SparkConfig {
    pythonPath: string;
    sparkHome: string;
    masterUrl: string;
    driverMemory: string;
    executorMemory: string;
}

export interface IcebergConfig {
    warehouse: string;
    catalog: string;
}

export interface UIConfig {
    theme: 'light' | 'dark';
    language: 'ko' | 'en';
}
