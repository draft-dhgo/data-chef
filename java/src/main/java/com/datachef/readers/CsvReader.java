package com.datachef.readers;

import com.datachef.config.PipeConfig;
import com.datachef.utils.Logger;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;

/**
 * Reader for CSV/delimited files
 */
public class CsvReader implements DataReader {
    @Override
    public Dataset<Row> read(SparkSession spark, String sourcePath, PipeConfig.Pipe pipe) throws Exception {
        String pattern = buildGlobPattern(sourcePath, pipe.filePattern.extension);
        Logger.info("Reading CSV files from pattern: " + pattern);

        PipeConfig.RecordBoundary boundary = pipe.recordBoundary;
        
        String delimiter = boundary.delimiter != null ? boundary.delimiter : ",";
        Boolean hasHeader = boundary.hasHeader != null ? boundary.hasHeader : true;
        String encoding = boundary.encoding != null ? boundary.encoding : "UTF-8";

        Dataset<Row> df = spark.read()
                .option("header", hasHeader.toString())
                .option("sep", delimiter)
                .option("encoding", encoding)
                .option("inferSchema", "true")
                .csv(pattern);

        Logger.info("Loaded " + df.count() + " records from CSV files");
        return df;
    }
}

