package com.datachef;

import com.datachef.config.ConfigParser;
import com.datachef.config.PipeConfig;
import com.datachef.readers.DataReader;
import com.datachef.readers.ReaderFactory;
import com.datachef.utils.Logger;
import com.datachef.writers.IcebergWriter;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;

/**
 * Main entry point for Data Chef Spark application
 */
public class DataChefJob {
    
    public static void main(String[] args) {
        SparkSession spark = null;
        
        try {
            // Check for action parameter (for table queries)
            String action = null;
            String tableName = null;
            int limit = 10;
            
            for (int i = 0; i < args.length; i++) {
                if ("--action".equals(args[i]) && i + 1 < args.length) {
                    action = args[i + 1];
                } else if ("--table".equals(args[i]) && i + 1 < args.length) {
                    tableName = args[i + 1];
                } else if ("--limit".equals(args[i]) && i + 1 < args.length) {
                    limit = Integer.parseInt(args[i + 1]);
                }
            }
            
            // Handle table query actions
            if (action != null) {
                handleQueryAction(action, tableName, limit, args);
                return;
            }
            
            // 1. Parse configuration
            Logger.info("Parsing configuration...");
            PipeConfig config = ConfigParser.parse(args);
            
            if (config.pipe == null || config.sourcePath == null) {
                Logger.error("Missing required configuration: pipe or sourcePath");
                System.exit(1);
            }
            
            Logger.info("Starting pipe execution: " + config.pipe.name);
            Logger.info("Source path: " + config.sourcePath);
            
            // 2. Create Spark session
            Logger.info("Creating Spark session...");
            spark = createSparkSession(config);
            Logger.info("Spark session created successfully");
            
            // 3. Read data
            Logger.info("Loading data...");
            String fileType = config.pipe.recordBoundary.type;
            DataReader reader = ReaderFactory.create(fileType);
            Dataset<Row> df = reader.read(spark, config.sourcePath, config.pipe);
            
            if (df.isEmpty()) {
                Logger.warn("No data to process - DataFrame is empty");
                spark.stop();
                System.exit(0);
            }
            
            Logger.info("Data loaded successfully. Schema:");
            df.printSchema();
            
            // 4. Write to Iceberg
            Logger.info("Writing data to Iceberg...");
            IcebergWriter.write(df, config.pipe.output, config.iceberg);
            
            Logger.info("Pipe execution completed successfully");
            System.exit(0);
            
        } catch (IllegalArgumentException e) {
            Logger.error("Configuration error: " + e.getMessage());
            if (spark != null) {
                spark.stop();
            }
            System.exit(1);
            
        } catch (Exception e) {
            Logger.error("Execution failed", e);
            if (spark != null) {
                spark.stop();
            }
            System.exit(1);
        }
    }
    
    /**
     * Handle table query actions (list, preview)
     */
    private static void handleQueryAction(String action, String tableName, int limit, String[] args) {
        SparkSession spark = null;
        
        try {
            // Parse config for Spark session
            PipeConfig config = ConfigParser.parse(args);
            
            // Create Spark session
            spark = createSparkSession(config);
            
            if ("list".equals(action)) {
                // List all tables by scanning warehouse directory
                String warehouse = config.iceberg.warehouse != null && !config.iceberg.warehouse.isEmpty()
                        ? config.iceberg.warehouse : "s3a://data-chef/warehouse";
                String namespace = "default";
                String warehousePath = warehouse + "/" + namespace;
                
                Logger.info("Listing tables in warehouse: " + warehousePath);
                
                try {
                    // Use Hadoop FileSystem to list directories in warehouse/default
                    org.apache.hadoop.fs.FileSystem fs = org.apache.hadoop.fs.FileSystem.get(
                            new java.net.URI(warehousePath),
                            spark.sparkContext().hadoopConfiguration()
                    );
                    
                    org.apache.hadoop.fs.Path path = new org.apache.hadoop.fs.Path(warehousePath);
                    java.util.List<String> tableNames = new java.util.ArrayList<>();
                    
                    if (fs.exists(path)) {
                        org.apache.hadoop.fs.FileStatus[] statuses = fs.listStatus(path);
                        for (org.apache.hadoop.fs.FileStatus status : statuses) {
                            if (status.isDirectory()) {
                                String tblName = status.getPath().getName();
                                Logger.info("Found table: " + tblName);
                                tableNames.add(tblName);
                            }
                        }
                    } else {
                        Logger.warn("Warehouse path does not exist: " + warehousePath);
                    }
                    
                    // Output JSON
                    com.google.gson.JsonObject result = new com.google.gson.JsonObject();
                    com.google.gson.JsonArray tablesArray = new com.google.gson.JsonArray();
                    for (String name : tableNames) {
                        com.google.gson.JsonObject table = new com.google.gson.JsonObject();
                        table.addProperty("name", name);
                        table.addProperty("namespace", namespace);
                        tablesArray.add(table);
                    }
                    result.add("tables", tablesArray);
                    
                    Logger.info("Found " + tableNames.size() + " tables");
                    System.out.println(new com.google.gson.Gson().toJson(result));
                } catch (Exception e) {
                    Logger.error("Failed to list tables: " + e.getMessage());
                    e.printStackTrace();
                }
                
                spark.stop();
                System.exit(0);
                
            } else if ("preview".equals(action) && tableName != null) {
                // Preview table data
                String catalogName = config.iceberg.catalog != null && !config.iceberg.catalog.isEmpty()
                        ? config.iceberg.catalog : "iceberg_catalog";
                String namespace = "default";
                String fullTableName = catalogName + "." + namespace + "." + tableName;
                
                Logger.info("Previewing table: " + fullTableName);
                
                org.apache.spark.sql.Dataset<org.apache.spark.sql.Row> df = 
                    spark.read().table(fullTableName).limit(limit);
                
                // Get schema
                com.google.gson.JsonArray schemaArray = new com.google.gson.JsonArray();
                for (org.apache.spark.sql.types.StructField field : df.schema().fields()) {
                    com.google.gson.JsonObject fieldObj = new com.google.gson.JsonObject();
                    fieldObj.addProperty("name", field.name());
                    fieldObj.addProperty("type", field.dataType().simpleString());
                    schemaArray.add(fieldObj);
                }
                
                // Get rows
                com.google.gson.JsonArray rowsArray = new com.google.gson.JsonArray();
                df.collectAsList().forEach(row -> {
                    com.google.gson.JsonObject rowObj = new com.google.gson.JsonObject();
                    for (int i = 0; i < row.size(); i++) {
                        Object value = row.get(i);
                        String fieldName = df.schema().fields()[i].name();
                        if (value == null) {
                            rowObj.add(fieldName, com.google.gson.JsonNull.INSTANCE);
                        } else {
                            rowObj.addProperty(fieldName, value.toString());
                        }
                    }
                    rowsArray.add(rowObj);
                });
                
                // Output JSON
                com.google.gson.JsonObject result = new com.google.gson.JsonObject();
                result.add("schema", schemaArray);
                result.add("rows", rowsArray);
                result.addProperty("rowCount", rowsArray.size());
                
                System.out.println(new com.google.gson.Gson().toJson(result));
                spark.stop();
                System.exit(0);
            }
            
        } catch (Exception e) {
            Logger.error("Query action failed", e);
            if (spark != null) {
                spark.stop();
            }
            System.exit(1);
        }
    }
    
    /**
     * Create SparkSession with S3A and Iceberg configurations
     */
    private static SparkSession createSparkSession(PipeConfig config) {
        PipeConfig.MinioConfig minio = config.minio;
        PipeConfig.SparkConfig sparkConf = config.spark;
        PipeConfig.IcebergConfig iceberg = config.iceberg;
        
        // Build S3A endpoint
        String s3Endpoint = String.format("%s://%s:%d",
                minio.useSSL ? "https" : "http",
                minio.endpoint,
                minio.port);
        
        // Build app name
        String appName = config.pipe != null && config.pipe.name != null 
                ? "DataChef_" + config.pipe.name 
                : "DataChef_Query";
        
        // Build Spark session
        SparkSession.Builder builder = SparkSession.builder()
                .appName(appName)
                .master(sparkConf.masterUrl != null ? sparkConf.masterUrl : "local[*]");
        
        // Memory settings
        if (sparkConf.driverMemory != null) {
            builder.config("spark.driver.memory", sparkConf.driverMemory);
        }
        if (sparkConf.executorMemory != null) {
            builder.config("spark.executor.memory", sparkConf.executorMemory);
        }
        
        // S3A configuration
        builder.config("spark.hadoop.fs.s3a.endpoint", s3Endpoint)
                .config("spark.hadoop.fs.s3a.access.key", minio.accessKey)
                .config("spark.hadoop.fs.s3a.secret.key", minio.secretKey)
                .config("spark.hadoop.fs.s3a.path.style.access", "true")
                .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
                .config("spark.hadoop.fs.s3a.aws.credentials.provider", 
                        "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider")
                .config("spark.hadoop.fs.s3a.connection.ssl.enabled", minio.useSSL.toString())
                .config("spark.hadoop.fs.s3a.connection.timeout", "200000")
                .config("spark.hadoop.fs.s3a.connection.establish.timeout", "120000")
                .config("spark.hadoop.fs.s3a.attempts.maximum", "20")
                .config("spark.hadoop.fs.s3a.connection.maximum", "100")
                .config("spark.hadoop.fs.s3a.change.detection.version.required", "false")
                .config("spark.hadoop.fs.s3a.change.detection.mode", "none");
        
        // Iceberg catalog configuration
        String catalogName = iceberg.catalog != null && !iceberg.catalog.isEmpty() 
                ? iceberg.catalog : "iceberg_catalog";
        String warehouse = iceberg.warehouse != null && !iceberg.warehouse.isEmpty() 
                ? iceberg.warehouse : "s3a://data-chef/warehouse";
        
        Logger.info("Iceberg catalog: " + catalogName + ", warehouse: " + warehouse);
        
        builder.config("spark.sql.warehouse.dir", warehouse)
                .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
                .config("spark.sql.catalog.spark_catalog", "org.apache.iceberg.spark.SparkSessionCatalog")
                .config("spark.sql.catalog.spark_catalog.type", "hadoop")
                .config("spark.sql.catalog.spark_catalog.warehouse", warehouse)
                .config("spark.sql.catalog." + catalogName, "org.apache.iceberg.spark.SparkCatalog")
                .config("spark.sql.catalog." + catalogName + ".type", "hadoop")
                .config("spark.sql.catalog." + catalogName + ".warehouse", warehouse);
        
        SparkSession spark = builder.getOrCreate();
        spark.sparkContext().setLogLevel("WARN");
        
        // Set Hadoop configuration to override any core-default.xml settings
        org.apache.hadoop.conf.Configuration hadoopConf = 
                spark.sparkContext().hadoopConfiguration();
        
        // Override duration settings to prevent "60s" parsing errors
        hadoopConf.unset("fs.s3a.connection.timeout");
        hadoopConf.set("fs.s3a.connection.timeout", "200000");
        hadoopConf.unset("fs.s3a.connection.establish.timeout");
        hadoopConf.set("fs.s3a.connection.establish.timeout", "120000");
        hadoopConf.unset("ipc.client.connect.timeout");
        hadoopConf.set("ipc.client.connect.timeout", "60000");
        hadoopConf.unset("ipc.ping.interval");
        hadoopConf.set("ipc.ping.interval", "60000");
        
        return spark;
    }
}

