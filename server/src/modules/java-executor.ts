import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { getConfig, JAVA_SPARK_JAR_PATH, JVM_OPTIONS, DEFAULT_JAVA_HOME } from '../config';

export interface JavaExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
}

export class JavaSparkExecutor {
    protected async executeJava(
        action: string,
        additionalArgs: string[],
        configJson: string,
        onStdout?: (data: string) => void,
        onStderr?: (data: string) => void
    ): Promise<JavaExecutionResult> {
        const config = getConfig();
        const javaHome = (config.spark as any).javaHome || process.env.JAVA_HOME || DEFAULT_JAVA_HOME;
        const javaExecutable = join(javaHome, 'bin', 'java');

        const jvmArgs = [
            ...JVM_OPTIONS,
            '-jar', JAVA_SPARK_JAR_PATH,
            '--action', action,
            ...additionalArgs,
            '--config', configJson
        ];

        return new Promise((resolve) => {
            const javaProcess = spawn(javaExecutable, jvmArgs, {
                cwd: join(__dirname, '../../../java'),
                env: {
                    ...process.env,
                    JAVA_HOME: javaHome,
                    PATH: `${javaHome}/bin:${process.env.PATH}`
                }
            });

            let stdout = '';
            let stderr = '';

            javaProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                stdout += output;
                if (onStdout) {
                    onStdout(output);
                }
            });

            javaProcess.stderr?.on('data', (data: Buffer) => {
                const output = data.toString();
                stderr += output;
                if (onStderr) {
                    onStderr(output);
                }
            });

            javaProcess.on('close', (code: number | null) => {
                if (code === 0) {
                    try {
                        const result = this.parseJsonOutput(stdout);
                        resolve({ success: true, data: result });
                    } catch (error) {
                        resolve({ success: false, error: `Failed to parse output: ${error}` });
                    }
                } else {
                    resolve({ success: false, error: `Java process failed with exit code: ${code}\n${stderr}` });
                }
            });

            javaProcess.on('error', (error: Error) => {
                resolve({ success: false, error: error.message });
            });
        });
    }

    protected parseJsonOutput(stdout: string): any {
        const lines = stdout.trim().split('\n');
        let jsonLine = null;

        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{')) {
                jsonLine = line;
                break;
            }
        }

        if (!jsonLine) {
            throw new Error('No JSON output found');
        }

        return JSON.parse(jsonLine);
    }

    protected parseJsonLogs(stderr: string, onLog: (level: string, message: string) => void): void {
        const lines = stderr.trim().split('\n');
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && trimmed.startsWith('{')) {
                try {
                    const log = JSON.parse(trimmed);
                    if (log.level && log.message) {
                        onLog(log.level, log.message);
                    }
                } catch {
                }
            }
        });
    }
}

