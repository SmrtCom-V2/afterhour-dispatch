-- Extend parking_type to include 'indoor' and 'courtyard' to match the frontend dropdown options
ALTER TABLE building DROP CONSTRAINT IF EXISTS building_parking_type_check;
ALTER TABLE building ADD CONSTRAINT building_parking_type_check
  CHECK (parking_type IN ('none', 'street', 'underground', 'garage', 'mixed', 'indoor', 'courtyard'));
