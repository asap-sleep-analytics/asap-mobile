#!/bin/bash
# Quick Test Script for Apnea Detection Integration
# Uso: bash test_apnea_integration.sh

echo "🧪 Testing Apnea Detection Integration"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${EXPO_PUBLIC_API_BASE_URL:-http://localhost:8000}"
AUDIO_FILE="audio_test.wav"
SPO2_VALUES="95,94,93,91,92,95,94,93,92,91"

echo "📋 Test Configuration"
echo "API URL: $API_URL"
echo "SpO2 Values: $SPO2_VALUES"
echo ""

# Test 1: Health check
echo "Test 1️⃣: Health Check"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed (HTTP $HEALTH)${NC}"
    echo "  Make sure: uvicorn main:app --host 0.0.0.0 --port 8000"
    exit 1
fi
echo ""

# Test 2: Check /predict endpoint
echo "Test 2️⃣: Check /predict Endpoint"
PREDICT_CHECK=$(curl -s "$API_URL/api/sleep/v3/health" | grep -o "modos_disponibles")
if [ ! -z "$PREDICT_CHECK" ]; then
    echo -e "${GREEN}✓ Prediction endpoint is available${NC}"
else
    echo -e "${YELLOW}⚠ Warning: Could not verify endpoint structure${NC}"
fi
echo ""

# Test 3: Test with sample audio file (if exists)
echo "Test 3️⃣: Test /predict with Audio"
if [ -f "$AUDIO_FILE" ]; then
    echo "Found audio file: $AUDIO_FILE"
    echo "Sending prediction request..."
    
    RESPONSE=$(curl -s -X POST "$API_URL/api/sleep/v3/predict" \
        -F "audio=@$AUDIO_FILE" \
        -F "spo2=$SPO2_VALUES" \
        -F "modo=screening" \
        -F "perfil=general")
    
    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    
    # Check if response contains expected fields
    if echo "$RESPONSE" | grep -q "nivel"; then
        echo -e "${GREEN}✓ Prediction successful${NC}"
    else
        echo -e "${RED}✗ Prediction failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping audio test (no $AUDIO_FILE found)${NC}"
    echo "  To test with audio: cp /path/to/your/audio.wav $AUDIO_FILE"
fi
echo ""

# Test 4: Configuration check
echo "Test 4️⃣: Environment Configuration"
if grep -q "EXPO_PUBLIC_API_BASE_URL" .env 2>/dev/null; then
    API_URL_ENV=$(grep "EXPO_PUBLIC_API_BASE_URL" .env | cut -d= -f2)
    echo -e "${GREEN}✓ Found EXPO_PUBLIC_API_BASE_URL=$API_URL_ENV${NC}"
else
    echo -e "${YELLOW}⚠ No EXPO_PUBLIC_API_BASE_URL in .env${NC}"
    echo "  Add to .env: EXPO_PUBLIC_API_BASE_URL=http://192.168.1.5:8000"
fi
echo ""

# Test 5: Required imports in MonitorActiveScreen
echo "Test 5️⃣: Code Integration Check"
if grep -q "predictApneaFromFile" "src/features/monitor/screens/MonitorActiveScreen.tsx" 2>/dev/null; then
    echo -e "${GREEN}✓ predictApneaFromFile imported${NC}"
else
    echo -e "${RED}✗ predictApneaFromFile not found in MonitorActiveScreen${NC}"
fi

if grep -q "ApneaResultCard" "src/features/monitor/screens/MonitorActiveScreen.tsx" 2>/dev/null; then
    echo -e "${GREEN}✓ ApneaResultCard component imported${NC}"
else
    echo -e "${RED}✗ ApneaResultCard not found in MonitorActiveScreen${NC}"
fi

if grep -q "generateSimulatedSpo2Values" "src/features/monitor/screens/MonitorActiveScreen.tsx" 2>/dev/null; then
    echo -e "${GREEN}✓ generateSimulatedSpo2Values function present${NC}"
else
    echo -e "${RED}✗ generateSimulatedSpo2Values function not found${NC}"
fi
echo ""

# Summary
echo "========================================"
echo -e "${GREEN}✨ Integration Tests Complete${NC}"
echo ""
echo "Next steps:"
echo "1. Start backend: uvicorn main:app --host 0.0.0.0 --port 8000"
echo "2. Verify .env has EXPO_PUBLIC_API_BASE_URL set"
echo "3. Launch app: npm start or expo start"
echo "4. Start monitoring - predictions will show automatically every 30s"
echo ""
