#!/usr/bin/env python3
"""Test the wavelet band gains endpoint"""

import urllib.request
import json

url = 'http://localhost:8000/api/wavelet/apply-band-gains'
data = {
    "mode": "animals",
    "allGains": [1.0, 1.2, 0.8, 1.5, 1.0, 1.0],
    "bandGains": {"animal-0": 1.5, "animal-1": 1.0},
    "maxLevel": 6,
    "sampleRate": 44100
}

print("Testing POST /api/wavelet/apply-band-gains")
print(f"Payload: {json.dumps(data, indent=2)}")
print()

req = urllib.request.Request(
    url,
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    response = urllib.request.urlopen(req)
    result = json.loads(response.read().decode())
    print("Response:")
    print(json.dumps(result, indent=2))
    print("\n✅ Endpoint is working!")
except Exception as e:
    print(f"❌ Error: {e}")
