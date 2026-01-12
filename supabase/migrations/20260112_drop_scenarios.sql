-- Migration: Drop scenarios table and related tables
-- Scenarios feature is being removed to focus on grammar drilling

-- Drop all scenario-related tables with CASCADE to handle dependencies
DROP TABLE IF EXISTS scenario_hotspots CASCADE;
DROP TABLE IF EXISTS scenario_words CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;
