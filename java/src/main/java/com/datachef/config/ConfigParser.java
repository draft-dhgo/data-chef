package com.datachef.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

public class ConfigParser {
    private static final Gson gson = new GsonBuilder()
            .setPrettyPrinting()
            .create();

    /**
     * Parse command-line arguments and extract JSON config
     * Expected format: --config <JSON_STRING>
     */
    public static PipeConfig parse(String[] args) throws IllegalArgumentException {
        String configJson = null;

        // Parse command line arguments
        for (int i = 0; i < args.length; i++) {
            if ("--config".equals(args[i]) && i + 1 < args.length) {
                configJson = args[i + 1];
                break;
            }
        }

        if (configJson == null || configJson.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing required --config argument");
        }

        try {
            return gson.fromJson(configJson, PipeConfig.class);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to parse config JSON: " + e.getMessage(), e);
        }
    }

    /**
     * Parse JSON string directly
     */
    public static PipeConfig parseJson(String json) throws IllegalArgumentException {
        try {
            return gson.fromJson(json, PipeConfig.class);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to parse config JSON: " + e.getMessage(), e);
        }
    }
}

