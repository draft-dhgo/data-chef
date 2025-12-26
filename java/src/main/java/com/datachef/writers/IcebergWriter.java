package com.datachef.writers;

import com.datachef.config.PipeConfig;
import com.datachef.utils.Logger;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SaveMode;

/**
 * Writer for Iceberg tables
 */
public class IcebergWriter {
    
    /**
     * Write DataFrame to Iceberg table
     *
     * @param df     DataFrame to write
     * @param output Output configuration
     * @param iceberg Iceberg configuration
     */
    public static void write(Dataset<Row> df, PipeConfig.Output output, PipeConfig.IcebergConfig iceberg) 
            throws Exception {
        
        // Build full table name: catalog.namespace.tableName
        String fullTableName = String.format("%s.%s.%s",
                output.catalog,
                output.namespace,
                output.tableName);

        Logger.info("Writing data to Iceberg table: " + fullTableName);
        Logger.info("Write mode: " + output.writeMode);
        Logger.info("Record count: " + df.count());

        try {
            // Determine write mode
            String writeMode = output.writeMode != null ? output.writeMode.toLowerCase() : "overwrite";
            
            if ("overwrite".equals(writeMode)) {
                // Use createOrReplace for overwrite mode
                df.writeTo(fullTableName)
                        .using("iceberg")
                        .option("write.format.default", "parquet")
                        .createOrReplace();
                
                Logger.info("Successfully created/replaced Iceberg table: " + fullTableName);
            } else if ("append".equals(writeMode)) {
                // Use write().format().mode() for append
                df.write()
                        .format("iceberg")
                        .mode(SaveMode.Append)
                        .save(fullTableName);
                
                Logger.info("Successfully appended data to Iceberg table: " + fullTableName);
            } else {
                throw new IllegalArgumentException("Unsupported write mode: " + writeMode);
            }

        } catch (Exception e) {
            Logger.error("Failed to write to Iceberg table: " + fullTableName, e);
            throw e;
        }
    }
}

