import { ChildProcess } from 'child_process';
import { getConfig } from '../config';
import { pipeManager } from './pipe-manager';
import { minioStorage } from './minio-storage';
import { JavaSparkExecutor } from './java-executor';
import type { ExecutionLog, ExecutionStatus } from '../types';

interface SparkProcess {
    process: ChildProcess;
    pipeId: string;
    status: ExecutionStatus;
}

class SparkRunnerService extends JavaSparkExecutor {
    private currentProcess: SparkProcess | null = null;

    async executePipe(
        pipeId: string,
        sourcePath: string,
        onLog: (log: ExecutionLog) => void
    ): Promise<{ success: boolean; error?: string }> {
        const pipe = pipeManager.getPipe(pipeId);
        if (!pipe) {
            return { success: false, error: 'Pipe not found' };
        }

        const config = getConfig();
        const s3SourcePath = minioStorage.getS3Path(sourcePath);

        const pipeConfig = JSON.stringify({
            pipe,
            sourcePath: s3SourcePath,
            minio: config.minio,
            spark: config.spark,
            iceberg: config.iceberg
        });

        const logMessage = (level: ExecutionLog['level'], message: string) => {
            onLog({
                timestamp: new Date().toISOString(),
                level,
                message
            });
        };

        logMessage('info', `Starting Spark job for pipe: ${pipe.name}`);
        logMessage('info', `Source path: ${sourcePath}`);

        const result = await this.executeJava(
            'execute',
            [],
            pipeConfig,
            (data) => {
                const lines = data.split('\n').filter(Boolean);
                for (const line of lines) {
                    logMessage('info', line);
                }
            },
            (data) => {
                this.parseJsonLogs(data, (level, message) => {
                    onLog({
                        timestamp: new Date().toISOString(),
                        level: level as ExecutionLog['level'],
                        message
                    });
                });
            }
        );

        if (result.success) {
            logMessage('info', 'Spark job completed successfully');
        } else {
            logMessage('error', `Spark job failed: ${result.error}`);
        }

        return result;
    }

    getSparkStatus(): { running: boolean; pipeId?: string } {
        if (this.currentProcess && this.currentProcess.status === 'running') {
            return { running: true, pipeId: this.currentProcess.pipeId };
        }
        return { running: false };
    }

    cancelSparkJob(): boolean {
        if (this.currentProcess && this.currentProcess.process) {
            this.currentProcess.process.kill('SIGTERM');
            this.currentProcess = null;
            return true;
        }
        return false;
    }
}

export const sparkRunner = new SparkRunnerService();
