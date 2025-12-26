package com.datachef.config;

import java.util.List;
import java.util.Map;

public class PipeConfig {
    public Pipe pipe;
    public String sourcePath;
    public MinioConfig minio;
    public SparkConfig spark;
    public IcebergConfig iceberg;

    public static class Pipe {
        public String id;
        public String name;
        public String description;
        public FilePattern filePattern;
        public RecordBoundary recordBoundary;
        public Schema schema;
        public Partitioning partitioning;
        public Output output;
        public String createdAt;
        public String updatedAt;
    }

    public static class FilePattern {
        public List<String> extensions;
        public String prefix;
        public String suffix;
    }

    public static class RecordBoundary {
        public String type;        // "json", "delimited", "parquet"
        public String encoding;
        public String delimiter;
        public Boolean hasHeader;
    }

    public static class Schema {
        public Boolean inferFromData;
        public List<Column> columns;
    }

    public static class Column {
        public String name;
        public String type;
        public Boolean nullable;
    }

    public static class Partitioning {
        public Boolean enabled;
        public List<String> keys;
    }

    public static class Output {
        public String tableName;
        public String catalog;
        public String namespace;
        public String writeMode;   // "overwrite", "append"
    }

    public static class MinioConfig {
        public String endpoint;
        public Integer port;
        public Boolean useSSL;
        public String accessKey;
        public String secretKey;
        public String defaultBucket;
    }

    public static class SparkConfig {
        public String pythonPath;
        public String sparkHome;
        public String masterUrl;
        public String driverMemory;
        public String executorMemory;
        public String javaHome;
    }

    public static class IcebergConfig {
        public String warehouse;
        public String catalog;
    }
}

