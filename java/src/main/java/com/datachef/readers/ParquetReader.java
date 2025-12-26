package com.datachef.readers;

import com.datachef.config.PipeConfig;
import com.datachef.utils.Logger;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;

/**
 * Reader for Parquet files
 */
public class ParquetReader implements DataReader {
    @Override
    public Dataset<Row> read(SparkSession spark, String sourcePath, PipeConfig.Pipe pipe) throws Exception {
        String pattern = buildGlobPattern(sourcePath, pipe.filePattern.extensions);
        Logger.info("Reading Parquet files from pattern: " + pattern);

        Dataset<Row> df = spark.read().parquet(pattern);

        Logger.info("Loaded " + df.count() + " records from Parquet files");
        return df;
    }
}

