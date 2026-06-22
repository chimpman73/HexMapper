@echo off
echo ========================================================
echo HEXMAPPER AUTOMATED TEST SUITE
echo ========================================================
echo.

cd backend\tests

echo Running Primary Regression Report (run_report.py)...
echo --------------------------------------------------------
python run_report.py
if %errorlevel% neq 0 (
    echo [ERROR] run_report.py failed!
    pause
    exit /b %errorlevel%
)
echo.

echo Running Partial Hex Matching Test (test_partial_hexes.py)...
echo --------------------------------------------------------
python test_partial_hexes.py
if %errorlevel% neq 0 (
    echo [ERROR] test_partial_hexes.py failed!
    pause
    exit /b %errorlevel%
)
echo.

echo ========================================================
echo ALL TESTS COMPLETED. Check backend\tests\results for detailed logs.
echo ========================================================
pause
