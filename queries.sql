-- This file contains example queries for analyzing activity and track point data from the fitness tracking database.
-- These queries demonstrate common data access patterns and analysis capabilities.


-- Query to retrieve all track points and activity details for a specific activity
-- Returns timestamped location, biometric and environmental data points joined with activity type
-- Ordered chronologically to show progression through the activity
SELECT 
    t.timestamp,
    t.latitude,
    t.longitude,
    t.elevation_meters,
    t.heart_rate,
    t.speed_mps,
    t.cadence,
    t.temperature,
    a.activity_type
FROM track_points t
JOIN activities a ON t.activity_id = a.activity_id
WHERE t.activity_id = '42f21498-ab00-4ebf-b561-ff000e4f3070'
ORDER BY t.timestamp ASC


