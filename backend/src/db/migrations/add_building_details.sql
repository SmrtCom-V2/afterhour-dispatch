-- Add comprehensive building details
-- Run this migration to add new fields to buildings

ALTER TABLE building
  ADD COLUMN IF NOT EXISTS building_type VARCHAR(20) DEFAULT 'residential'
    CHECK (building_type IN ('residential', 'commercial', 'mixed')),
  ADD COLUMN IF NOT EXISTS num_apartments INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_entrances INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS num_floors INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS num_elevators INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_parking BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_garden BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN building.building_type IS 'Type of building: residential, commercial, or mixed';
COMMENT ON COLUMN building.num_apartments IS 'Total number of apartments/units in the building';
COMMENT ON COLUMN building.num_entrances IS 'Number of building entrances';
COMMENT ON COLUMN building.num_floors IS 'Number of floors including ground floor';
COMMENT ON COLUMN building.num_elevators IS 'Number of elevators';
COMMENT ON COLUMN building.has_parking IS 'Whether the building has parking facilities';
COMMENT ON COLUMN building.has_garden IS 'Whether the building has a garden/courtyard';
COMMENT ON COLUMN building.notes IS 'Additional notes about the building';
