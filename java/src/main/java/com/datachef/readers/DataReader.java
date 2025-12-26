package com.datachef.readers;

import com.datachef.config.PipeConfig;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;

/**
 * Interface for reading data from various sources
 */
public interface DataReader {
    /**
     * Read data from the specified path
     *
     * @param spark      SparkSession
     * @param sourcePath S3A path to the data
     * @param pipe       Pipe configuration
     * @return Dataset containing the read data
     */
    Dataset<Row> read(SparkSession spark, String sourcePath, PipeConfig.Pipe pipe) throws Exception;

    /**
     * Build glob pattern for file filtering
     */
    default String buildGlobPattern(String basePath, java.util.List<String> extensions) {
        if (extensions == null || extensions.isEmpty()) {
            return basePath + "/*";
        }

        if (extensions.size() == 1) {
            return basePath + "/*." + extensions.get(0);
        }

        // Multiple extensions: path/*.{json,csv,txt}
        String extensionsStr = String.join(",", extensions);
        return basePath + "/*.{" + extensionsStr + "}";
    }
}

