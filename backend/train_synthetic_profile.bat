@echo off
cd /d "%~dp0tests"
echo Generating synthetic test maps...
python generate_artificial_map.py
copy /Y artificial_map.png Terrain.png

echo Training terrain profile using artificial map...
python ../train_profile.py --dir . --fix artificial_map_truth.json --style "Hollow Moon"

echo Training complete! The user_terrain_profile.json for Hollow Moon has been updated.
cd ..
