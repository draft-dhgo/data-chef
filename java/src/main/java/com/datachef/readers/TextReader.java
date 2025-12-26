package com.datachef.readers;

import com.datachef.config.PipeConfig;
import com.datachef.utils.Logger;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.types.DataTypes;
import org.apache.spark.sql.types.StructField;
import org.apache.spark.sql.types.StructType;
import static org.apache.spark.sql.functions.*;

import java.util.ArrayList;
import java.util.List;

public class TextReader implements DataReader {
    @Override
    public Dataset<Row> read(SparkSession spark, String sourcePath, PipeConfig.Pipe pipe) throws Exception {
        String pattern = buildGlobPattern(sourcePath, pipe.filePattern.extension);
        Logger.info("Reading text files from pattern: " + pattern);

        String encoding = pipe.recordBoundary.encoding != null ? 
                pipe.recordBoundary.encoding : "UTF-8";

        Dataset<Row> rawText = spark.read()
                .option("encoding", encoding)
                .textFile(pattern)
                .toDF("value");

        Logger.info("Loaded " + rawText.count() + " lines from text files");

        PipeConfig.FieldExtraction extraction = pipe.recordBoundary.fieldExtraction;
        if (extraction == null || extraction.fields == null || extraction.fields.isEmpty()) {
            Logger.error("Text file requires fieldExtraction with regex fields");
            throw new IllegalArgumentException("fieldExtraction.fields is required for text type");
        }

        if (!"regex".equals(extraction.method)) {
            Logger.error("Only 'regex' method is supported for text files");
            throw new IllegalArgumentException("Only 'regex' method is supported for text type");
        }

        Dataset<Row> result = rawText;
        List<org.apache.spark.sql.Column> selectColumns = new ArrayList<>();

        for (PipeConfig.RegexField field : extraction.fields) {
            Logger.info("Extracting field '" + field.name + "' with pattern: " + field.pattern);
            
            org.apache.spark.sql.Column extractedCol = regexp_extract(
                col("value"), 
                field.pattern, 
                field.group != null ? field.group : 1
            ).alias(field.name);
            
            selectColumns.add(extractedCol);
        }

        result = result.select(
            selectColumns.toArray(new org.apache.spark.sql.Column[0])
        );

        String onError = extraction.onError != null ? extraction.onError : "null";
        if ("skip".equals(onError)) {
            for (PipeConfig.RegexField field : extraction.fields) {
                result = result.filter(col(field.name).notEqual(""));
            }
            Logger.info("Filtered out rows with empty extracted fields");
        }

        Logger.info("Successfully extracted " + extraction.fields.size() + " fields from text data");
        result.printSchema();
        
        return result;
    }
}

