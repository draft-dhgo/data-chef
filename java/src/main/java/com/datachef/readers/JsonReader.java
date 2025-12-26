package com.datachef.readers;

import com.datachef.config.PipeConfig;
import com.datachef.utils.Logger;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;

/**
 * Reader for JSON files
 */
public class JsonReader implements DataReader {
    @Override
    public Dataset<Row> read(SparkSession spark, String sourcePath, PipeConfig.Pipe pipe) throws Exception {
        String pattern = buildGlobPattern(sourcePath, pipe.filePattern.extensions);
        Logger.info("Reading JSON files from pattern: " + pattern);

        String encoding = pipe.recordBoundary.encoding != null ? 
                pipe.recordBoundary.encoding : "UTF-8";

        Dataset<Row> df = spark.read()
                .option("encoding", encoding)
                .option("multiLine", "false")  // Assume each line is a JSON object
                .json(pattern);

        Logger.info("Loaded " + df.count() + " records from JSON files");
        return df;
    }
}

