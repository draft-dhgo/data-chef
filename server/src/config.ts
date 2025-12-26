/**
 * 서버 설정 관리
 * (Electron 의존성 제거)
 */

import { join } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { AppConfig } from './types';

let config: AppConfig;

const defaultConfig: AppConfig = {
    app: {
        name: 'Data Chef',
        version: '1.0.0'
    },
    minio: {
        endpoint: 'localhost',
        port: 9000,
        useSSL: false,
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
        defaultBucket: 'data-chef'
    },
    spark: {
        pythonPath: 'python3',
        sparkHome: process.env.SPARK_HOME || '',
        masterUrl: 'local[*]',
        driverMemory: '2g',
        executorMemory: '2g'
    },
    iceberg: {
        warehouse: 's3a://data-chef/warehouse',
        catalog: 'iceberg_catalog'
    },
    ui: {
        theme: 'dark',
        language: 'ko'
    }
};

// 설정 파일 경로
function getConfigPath(): string {
    if (process.env.DATA_CHEF_CONFIG_PATH) {
        return process.env.DATA_CHEF_CONFIG_PATH;
    }
    const configDir = join(homedir(), '.data-chef');
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }
    return join(configDir, 'config.json');
}

// 설정 로드
export async function loadConfig(): Promise<AppConfig> {
    const configPath = getConfigPath();

    if (existsSync(configPath)) {
        try {
            const data = readFileSync(configPath, 'utf-8');
            config = { ...defaultConfig, ...JSON.parse(data) };
        } catch {
            config = defaultConfig;
        }
    } else {
        config = defaultConfig;
        // 기본 설정 저장
        writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    console.log(`${LOG_TAGS.CONFIG} Loaded from: ${configPath}`);
    return config;
}

// 현재 설정 반환
export function getConfig(): AppConfig {
    if (!config) {
        config = defaultConfig;
    }
    return config;
}

// 설정 업데이트
export function updateConfig(updates: Partial<AppConfig>): AppConfig {
    config = { ...config, ...updates };
    const configPath = getConfigPath();
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return config;
}

export const JAVA_SPARK_JAR_PATH = join(__dirname, '../../java/build/libs/data-chef-spark-1.0.jar');

export const JVM_OPTIONS = [
    '--add-opens=java.base/java.lang=ALL-UNNAMED',
    '--add-opens=java.base/java.lang.invoke=ALL-UNNAMED',
    '--add-opens=java.base/java.lang.reflect=ALL-UNNAMED',
    '--add-opens=java.base/java.io=ALL-UNNAMED',
    '--add-opens=java.base/java.net=ALL-UNNAMED',
    '--add-opens=java.base/java.nio=ALL-UNNAMED',
    '--add-opens=java.base/java.util=ALL-UNNAMED',
    '--add-opens=java.base/java.util.concurrent=ALL-UNNAMED',
    '--add-opens=java.base/java.util.concurrent.atomic=ALL-UNNAMED',
    '--add-opens=java.base/sun.nio.ch=ALL-UNNAMED',
    '--add-opens=java.base/sun.nio.cs=ALL-UNNAMED',
    '--add-opens=java.base/sun.security.action=ALL-UNNAMED',
    '--add-opens=java.base/sun.util.calendar=ALL-UNNAMED'
];

export const DEFAULT_JAVA_HOME = '/opt/homebrew/opt/openjdk@17';

export const LOG_TAGS = {
    DB: '[DB]',
    MINIO: '[MinIO]',
    TABLES: '[Tables]',
    PREVIEW: '[Preview]',
    PIPE: '[Pipe]',
    STORAGE: '[Storage]',
    CONFIG: '[Config]',
    SERVER: '[Server]'
};
