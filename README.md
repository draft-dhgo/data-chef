# Data Chef

Express 백엔드 + React 프론트엔드 + Java Spark 기반의 데이터 파이프라인 도구

## 개요

Data Chef는 로컬 파일 시스템의 데이터를 MinIO 기반의 Iceberg 테이블로 변환하는 웹 애플리케이션입니다. 재사용 가능한 **"파이프"** 단위로 데이터 처리 워크플로우를 정의하고, 어떤 폴더에든 동일한 패턴을 적용할 수 있습니다.

## 주요 기능

- 📂 **파일 패턴 필터링**: 확장자로 파일 필터링
- 🔍 **정규표현식 파싱**: 로그 파일 등 비정형 텍스트를 정규표현식으로 필드 추출
- 📊 **스키마 정의**: 자동 추론 또는 수동 컬럼 타입 지정
- 🔄 **파이프 재사용**: 한 번 정의한 파이프를 여러 폴더에 적용
- 🚀 **Spark 처리**: Java Spark를 통한 빠르고 안정적인 데이터 처리
- 🤖 **MCP 서버**: AI 클라이언트에서 파이프 관리 가능
- ⚡ **고성능**: Java 네이티브 실행으로 5분 → 10초로 처리 속도 향상

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Backend | Express 5 + TypeScript |
| Frontend | React 19 + Vite 7 |
| Data Processing | Apache Spark 3.5 (Java 17) |
| Table Format | Apache Iceberg 1.4 |
| Object Storage | MinIO |
| Local DB | SQLite (better-sqlite3) |
| AI Integration | MCP SSE Server |
| Build Tool | Gradle 8 + Shadow Plugin |

## 사전 요구사항

- **Node.js** 18+
- **Java** 17+ (Spark 실행용)
- **Gradle** 8+ (빌드용, wrapper 포함)
- **Docker** (MinIO 컨테이너용)

## 빠른 시작

### 1. 인프라 시작 (MinIO)

```bash
./start_infra.sh
```

이 스크립트는 자동으로:
- Docker 실행 상태 확인 (필요시 Docker Desktop 자동 시작)
- MinIO 컨테이너 시작 (포트 9000, 9001)
- 서비스 상태 확인

**MinIO 접속:**
- API: http://localhost:9000
- 콘솔: http://localhost:9001
- 계정: `minioadmin` / `minioadmin`

**인프라 종료:**
```bash
./stop_infra.sh
```

### 2. Java Spark 애플리케이션 빌드

**Java 설치 (macOS):**
```bash
brew install openjdk@17

echo 'export JAVA_HOME=/opt/homebrew/opt/openjdk@17' >> ~/.zshrc
echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Java 설치 (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install openjdk-17-jdk

echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Java 버전 확인:**
```bash
java -version
```

**Spark JAR 빌드:**
```bash
cd java
./gradlew shadowJar
```

빌드 결과물: `java/build/libs/data-chef-spark-1.0.jar` (약 509MB)

이 JAR 파일은 Spark, Hadoop, Iceberg 등 모든 의존성을 포함한 Fat JAR입니다.

### 3. 백엔드 서버

```bash
cd server
npm install
npm run dev
```

서버가 `http://localhost:3001`에서 시작됩니다.

**주요 엔드포인트:**
- REST API: `http://localhost:3001/api`
- MCP Server: `http://localhost:3001/mcp`

### 4. 프론트엔드 클라이언트

```bash
cd client
npm install
npm run dev
```

클라이언트가 `http://localhost:5173`에서 시작됩니다.

## 설정 파일

첫 실행 시 `~/.data-chef/config.json` 파일이 자동 생성됩니다:

```json
{
  "app": {
    "name": "Data Chef",
    "version": "1.0.0"
  },
  "minio": {
    "endpoint": "localhost",
    "port": 9000,
    "useSSL": false,
    "accessKey": "minioadmin",
    "secretKey": "minioadmin",
    "defaultBucket": "data-chef"
  },
  "spark": {
    "javaHome": "/opt/homebrew/opt/openjdk@17",
    "masterUrl": "local[*]",
    "driverMemory": "2g",
    "executorMemory": "2g"
  },
  "iceberg": {
    "warehouse": "s3a://data-chef/warehouse",
    "catalog": "iceberg_catalog"
  }
}
```

필요시 `spark.javaHome` 경로를 수정하세요.

## 프로젝트 구조

```
data-chef/
├── server/                           # Express 백엔드
│   ├── src/
│   │   ├── index.ts                  # 서버 진입점 (REST + MCP)
│   │   ├── config.ts                 # 설정 관리
│   │   ├── types.ts                  # 공통 타입 정의
│   │   ├── routes/                   # REST API 라우터
│   │   │   ├── execution.ts          # 파이프 실행 API
│   │   │   ├── pipes.ts              # 파이프 CRUD API
│   │   │   ├── storage.ts            # MinIO 스토리지 API
│   │   │   └── tables.ts             # Iceberg 테이블 API
│   │   └── modules/                  # 비즈니스 로직
│   │       ├── java-executor.ts      # Java Spark 실행
│   │       ├── pipe-manager.ts       # 파이프 관리 (SQLite)
│   │       ├── minio-storage.ts      # MinIO 연동
│   │       ├── iceberg-query.ts      # Iceberg 쿼리
│   │       └── spark-runner.ts       # Spark 작업 실행
│   └── package.json
├── client/                           # React 프론트엔드
│   ├── src/
│   │   ├── main.tsx                  # 앱 진입점
│   │   ├── App.tsx                   # 라우터 설정
│   │   ├── api/                      # REST API 클라이언트
│   │   │   └── index.ts
│   │   ├── pages/                    # 페이지 컴포넌트
│   │   │   ├── Dashboard.tsx         # 대시보드
│   │   │   ├── Pipes.tsx             # 파이프 목록
│   │   │   ├── PipeEditor.tsx        # 파이프 편집
│   │   │   ├── Execute.tsx           # 파이프 실행
│   │   │   ├── Storage.tsx           # 스토리지 브라우저
│   │   │   ├── Tables.tsx            # 테이블 목록
│   │   │   ├── TableDetail.tsx       # 테이블 상세
│   │   │   └── Settings.tsx          # 설정
│   │   ├── components/               # 공통 컴포넌트
│   │   │   ├── Layout.tsx            # 레이아웃
│   │   │   └── FileBrowser.tsx       # 파일 브라우저
│   │   └── styles/
│   └── package.json
├── java/                             # Java Spark 애플리케이션
│   ├── src/main/java/com/datachef/
│   │   ├── DataChefJob.java          # Main 진입점
│   │   ├── config/                   # 설정 파싱
│   │   │   ├── ConfigParser.java
│   │   │   └── PipeConfig.java
│   │   ├── readers/                  # 데이터 Reader
│   │   │   ├── DataReader.java
│   │   │   ├── ReaderFactory.java
│   │   │   ├── JsonReader.java
│   │   │   ├── CsvReader.java
│   │   │   └── ParquetReader.java
│   │   ├── writers/                  # Iceberg Writer
│   │   │   └── IcebergWriter.java
│   │   └── utils/
│   │       └── Logger.java
│   ├── build.gradle                  # Gradle 빌드 설정
│   └── build/libs/                   # 빌드된 JAR
├── config/
│   └── default.json                  # 기본 설정
├── docker-compose.yml                # MinIO 컨테이너
├── start_infra.sh                    # 인프라 시작 스크립트
└── stop_infra.sh                     # 인프라 종료 스크립트
```

## REST API

**Base URL**: `http://localhost:3001/api`

### Pipes (파이프 관리)

| Method | Endpoint | 설명 | Body |
|--------|----------|------|------|
| GET | `/pipes` | 파이프 목록 조회 | - |
| GET | `/pipes/:id` | 파이프 상세 조회 | - |
| POST | `/pipes` | 파이프 생성 | `{ name, description, storagePath, filePattern, recordBoundary, schema, partitioning, output }` |
| PUT | `/pipes/:id` | 파이프 수정 | `{ name, description, storagePath, filePattern, recordBoundary, schema, partitioning, output }` |
| DELETE | `/pipes/:id` | 파이프 삭제 | - |
| POST | `/pipes/:id/duplicate` | 파이프 복제 | - |

### Execution (파이프 실행)

| Method | Endpoint | 설명 | Body |
|--------|----------|------|------|
| POST | `/execution` | 파이프 실행 | `{ pipeId, storagePath }` |
| GET | `/execution/status` | 실행 상태 조회 | - |
| POST | `/execution/cancel` | 실행 중인 작업 취소 | - |

### Storage (MinIO)

| Method | Endpoint | 설명 | Query |
|--------|----------|------|-------|
| GET | `/storage` | 스토리지 파일/폴더 목록 | `?path=/some/path` |
| POST | `/storage/upload` | 파일 업로드 | FormData |
| DELETE | `/storage` | 파일/폴더 삭제 | `{ path }` |

### Tables (Iceberg)

| Method | Endpoint | 설명 | Query |
|--------|----------|------|-------|
| GET | `/tables` | 테이블 목록 조회 | - |
| GET | `/tables/:name` | 테이블 상세 정보 | - |
| GET | `/tables/:name/data` | 테이블 데이터 조회 | `?limit=100&offset=0` |
| DELETE | `/tables/:name` | 테이블 삭제 | - |

## MCP 서버

Data Chef는 MCP(Model Context Protocol) SSE 서버를 제공합니다. AI 클라이언트(Claude Desktop, Cursor 등)에서 자연어로 파이프를 관리하고 실행할 수 있습니다.

### MCP 엔드포인트

`http://localhost:3001/mcp`

### 제공 Tools

| Tool | 설명 | 주요 파라미터 |
|------|------|-------------|
| `list_pipes` | 파이프 목록 조회 | - |
| `get_pipe` | 특정 파이프 조회 | `pipeId` |
| `create_pipe` | 파이프 생성 | `name`, `storagePath`, `fileExtension`, `recordType`, `tableName` (필수), `delimiter`, `hasHeader`, `regexFields` (선택) |
| `update_pipe` | 파이프 수정 | `pipeId`, `name`, `filePattern`, `output` 등 |
| `delete_pipe` | 파이프 삭제 | `pipeId` |
| `duplicate_pipe` | 파이프 복제 | `pipeId`, `newName` |
| `list_storage` | MinIO 스토리지 파일/폴더 조회 | `path` |
| `execute_pipe` | 파이프 실행 | `pipeId`, `storagePath` |
| `get_execution_status` | 현재 실행 중인 작업 상태 조회 | - |
| `cancel_execution` | 실행 중인 작업 취소 | - |
| `list_tables` | Iceberg 테이블 목록 조회 | - |
| `get_table_info` | 테이블 상세 정보 조회 | `tableName` |
| `query_table` | 테이블 데이터 조회 | `tableName`, `limit`, `offset` |
| `delete_table` | 테이블 삭제 | `tableName` |

### Tool 상세 설명

#### create_pipe

파이프는 다음과 같은 구조로 생성됩니다.

**MCP Tool 파라미터**:
- **필수**: `name`, `storagePath`, `fileExtension`, `recordType`, `tableName`
- **선택**: `description`, `namespace`, `writeMode`
- **CSV용**: `delimiter`, `hasHeader`
- **텍스트/로그용**: `regexFields` - 필드별 정규표현식 배열
  - 각 필드: `{ name: string, pattern: string, group: number }`
  - 예시: `[{ name: "timestamp", pattern: "^(\\d{4}-\\d{2}-\\d{2})", group: 1 }]`

**파일 패턴 설정 (filePattern)**:
```json
{
  "extension": "json"
}
```

**레코드 형식 (recordBoundary)**:
```json
{
  "type": "json" | "delimited" | "parquet" | "text",
  "delimiter": ",",
  "hasHeader": true,
  "encoding": "UTF-8",
  "fieldExtraction": {
    "method": "regex",
    "fields": [
      { "name": "timestamp", "pattern": "^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2})", "group": 1 },
      { "name": "level", "pattern": "\\s([A-Z]+)\\s", "group": 1 },
      { "name": "message", "pattern": "\\]\\s(.*)$", "group": 1 }
    ]
  }
}
```

**스키마 (schema)** - 선택사항, 미지정 시 자동 추론:
```json
{
  "inferFromData": true,
  "columns": [
    { "name": "id", "type": "long" },
    { "name": "name", "type": "string" },
    { "name": "timestamp", "type": "timestamp" }
  ]
}
```

**출력 설정 (output)**:
```json
{
  "tableName": "my_table",
  "catalog": "iceberg_catalog",
  "namespace": "default",
  "writeMode": "overwrite" | "append"
}
```

**CSV 파일 예시**:
```json
{
  "name": "CSV 데이터 파이프",
  "description": "CSV 파일을 Iceberg 테이블로 변환",
  "storagePath": "/path/to/data",
  "filePattern": {
    "extension": "csv"
  },
  "recordBoundary": {
    "type": "delimited",
    "delimiter": ",",
    "hasHeader": true,
    "encoding": "UTF-8"
  },
  "schema": {
    "inferFromData": true,
    "columns": []
  },
  "partitioning": {
    "enabled": false,
    "keys": []
  },
  "output": {
    "tableName": "csv_data",
    "catalog": "iceberg_catalog",
    "namespace": "default",
    "writeMode": "overwrite"
  }
}
```

**로그 파싱 예시 (정규표현식 사용)**:
```json
{
  "name": "Apache 로그 파이프",
  "description": "Apache 로그를 정규표현식으로 파싱하여 Iceberg 테이블로 변환",
  "storagePath": "/path/to/logs",
  "filePattern": {
    "extension": "log"
  },
  "recordBoundary": {
    "type": "text",
    "encoding": "UTF-8",
    "fieldExtraction": {
      "method": "regex",
      "fields": [
        { "name": "timestamp", "pattern": "^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2})", "group": 1 },
        { "name": "level", "pattern": "\\[(\\w+)\\]", "group": 1 },
        { "name": "source", "pattern": "\\]\\s+(\\S+)", "group": 1 },
        { "name": "message", "pattern": "-\\s+(.*)$", "group": 1 }
      ]
    }
  },
  "schema": {
    "inferFromData": false,
    "columns": [
      { "name": "timestamp", "type": "string", "nullable": false },
      { "name": "level", "type": "string", "nullable": false },
      { "name": "source", "type": "string", "nullable": false },
      { "name": "message", "type": "string", "nullable": true }
    ]
  },
  "partitioning": {
    "enabled": false,
    "keys": []
  },
  "output": {
    "tableName": "apache_logs",
    "catalog": "iceberg_catalog",
    "namespace": "default",
    "writeMode": "append"
  }
}
```

**MCP를 통한 로그 파싱 파이프 생성 예시**:
```
Claude에게 요청: "Apache 로그 파일들을 파싱하는 파이프를 만들어줘. 
파일은 /logs/apache 폴더에 있고, .log 파일이야.
로그 형식은: 2024-01-15 10:30:45 [INFO] server.py - Request completed
이걸 timestamp, level, source, message 필드로 분리해서 apache_logs 테이블에 저장해줘."

→ Claude가 create_pipe tool을 사용하여:
- name: "Apache 로그 파이프"
- storagePath: "/logs/apache"
- fileExtension: "log"
- recordType: "text"
- regexFields: [
    { name: "timestamp", pattern: "^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2})", group: 1 },
    { name: "level", pattern: "\\[(\\w+)\\]", group: 1 },
    { name: "source", pattern: "\\]\\s+(\\S+)", group: 1 },
    { name: "message", pattern: "-\\s+(.*)$", group: 1 }
  ]
- tableName: "apache_logs"
```

#### update_pipe

기존 파이프의 설정을 부분적으로 수정합니다. 변경하지 않을 필드는 생략 가능합니다.

#### execute_pipe

지정된 파이프를 특정 스토리지 경로에 실행합니다. Java Spark를 통해 데이터를 처리하고 Iceberg 테이블로 저장합니다. 실행 결과와 로그를 반환합니다.

### Claude Desktop 연결

MCP 서버는 백엔드 서버(`npm run dev`)와 함께 자동으로 시작됩니다.

`~/Library/Application Support/Claude/claude_desktop_config.json`에 다음 설정 추가:

```json
{
  "mcpServers": {
    "data-chef": {
      "command": "node",
      "args": [
        "/path/to/data-chef/server/node_modules/tsx/dist/cli.js",
        "watch",
        "/path/to/data-chef/server/src/index.ts"
      ],
      "cwd": "/path/to/data-chef/server",
      "env": {
        "PORT": "3001"
      }
    }
  }
}
```

또는 서버를 별도로 실행하고 SSE 연결:

```json
{
  "mcpServers": {
    "data-chef": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

### MCP Inspector 테스트

```bash
cd server
npm run dev

npx @modelcontextprotocol/inspector http://localhost:3001/mcp
```

## 데이터 처리 흐름

1. **파이프 정의**: 웹 UI 또는 MCP를 통해 데이터 처리 규칙 정의
2. **파일 필터링**: MinIO 스토리지에서 패턴에 맞는 파일 검색
3. **데이터 읽기**: Java Reader가 파일 형식에 맞게 데이터 파싱
4. **스키마 적용**: 자동 추론 또는 사전 정의된 스키마 적용
5. **Iceberg 저장**: Spark를 통해 Iceberg 테이블로 저장
6. **쿼리 가능**: SQL을 통해 저장된 데이터 조회

## 지원 파일 형식

| 형식 | 타입 | 처리 방식 |
|------|------|----------|
| JSON | `json` | `JsonReader` |
| CSV/Delimited | `delimited` | `CsvReader` |
| Parquet | `parquet` | `ParquetReader` |
| Text/Log | `text` | 정규표현식 기반 필드 추출 (fieldExtraction) |

## 문제 해결

### Docker 실행 오류

`start_infra.sh` 실행 시 Docker가 시작되지 않는 경우:

```bash
open -a Docker

docker info
```

수동으로 Docker Desktop을 시작한 후 다시 시도하세요.

### Java 버전 오류

파이프 실행 시 Java 버전 오류가 발생하는 경우:

```
UnsupportedClassVersionError: ... (class file version 61.0)
```

이 오류는 Java 버전이 낮아서 발생합니다. Java 17 이상으로 업그레이드하세요:

```bash
java -version

echo $JAVA_HOME
```

### Spark JAR 파일 없음

`java/build/libs/data-chef-spark-1.0.jar` 파일이 없는 경우:

```bash
cd java
./gradlew clean shadowJar

ls -lh build/libs/
```

### MinIO 연결 오류

파이프 실행 시 MinIO 연결 오류가 발생하는 경우:

```bash
docker ps | grep minio

curl http://localhost:9000/minio/health/live
```

MinIO가 실행 중이 아니라면:

```bash
./start_infra.sh
```

### Spark 메모리 오류

Spark 실행 중 메모리 오류가 발생하는 경우, `~/.data-chef/config.json`에서 메모리 설정 조정:

```json
{
  "spark": {
    "driverMemory": "4g",
    "executorMemory": "4g"
  }
}
```

### 로그 확인

서버 로그 확인:

```bash
cd server
npm run dev
```

Java Spark 로그는 파이프 실행 시 콘솔에 출력됩니다.

## 성능

- **처리 속도**: Java Spark 기반으로 대용량 데이터 고속 처리
- **메모리**: 파일 스트리밍 방식으로 메모리 효율적 처리
- **확장성**: Spark 클러스터 모드로 확장 가능
