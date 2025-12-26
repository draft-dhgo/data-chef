package com.datachef.readers;

/**
 * Factory for creating appropriate DataReader based on file type
 */
public class ReaderFactory {
    public static DataReader create(String fileType) throws IllegalArgumentException {
        if (fileType == null) {
            throw new IllegalArgumentException("File type cannot be null");
        }

        switch (fileType.toLowerCase()) {
            case "json":
                return new JsonReader();
            case "delimited":
            case "csv":
                return new CsvReader();
            case "parquet":
                return new ParquetReader();
            case "text":
                return new TextReader();
            default:
                throw new IllegalArgumentException("Unsupported file type: " + fileType);
        }
    }
}

