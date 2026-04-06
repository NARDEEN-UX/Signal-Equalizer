"""
Test animal wavelet level mapping to verify all frequencies are covered correctly
"""
import numpy as np

SAMPLE_RATE = 44100

# Expected animal ranges
ANIMAL_RANGES = {
    'frog': {'low': 225, 'high': 504},
    'birds': {'low': 4255, 'high': 11025},
    'dog': {'low': 504, 'high': 1943},
    'cat': {'low': 1943, 'high': 4255}
}

# Updated level mapping (7 levels + approximation for full coverage)
ANIMAL_LEVEL_MAP = {
    "frog": [6, 7, "cA"],
    "birds": [1, 2, 3],
    "dog": [4, 5, 6],
    "cat": [2, 3, 4]
}

def detail_level_band(level_idx, sample_rate):
    """Calculate frequency range for a wavelet detail level"""
    high = sample_rate / (2 ** level_idx)
    low = sample_rate / (2 ** (level_idx + 1))
    return low, high

def approx_level_band(level, sample_rate):
    """Calculate frequency range for approximation coefficients"""
    return 0, sample_rate / (2 ** level)

# Print level frequency ranges
print("=" * 80)
print("WAVELET LEVEL FREQUENCY RANGES (44.1 kHz, 7 levels)")
print("=" * 80)

for lv in range(1, 8):
    low, high = detail_level_band(lv, SAMPLE_RATE)
    print(f"L{lv}: {low:.1f} - {high:.1f} Hz")

app_low, app_high = approx_level_band(7, SAMPLE_RATE)
print(f"cA: {app_low:.1f} - {app_high:.1f} Hz (Approximation)")

print("\n" + "=" * 80)
print("ANIMAL RANGES vs WAVELET LEVEL COVERAGE")
print("=" * 80 + "\n")

# Check how well each animal is covered
for animal, level_list in ANIMAL_LEVEL_MAP.items():
    animal_low = ANIMAL_RANGES[animal]['low']
    animal_high = ANIMAL_RANGES[animal]['high']
    
    covered_freqs = []
    covered_ranges = []
    for lv in level_list:
        if lv == "cA":
            low, high = approx_level_band(7, SAMPLE_RATE)
            covered_freqs.append(f"cA:{low:.0f}-{high:.0f}")
        elif isinstance(lv, int) and lv <= 7:
            low, high = detail_level_band(lv, SAMPLE_RATE)
            covered_freqs.append(f"L{lv}:{low:.0f}-{high:.0f}")
        covered_ranges.append((low, high))
    
    coverage_str = " + ".join(covered_freqs)
    print(f"🔊 {animal.upper()}: {animal_low}-{animal_high} Hz")
    print(f"   → Levels: {level_list}")
    print(f"   → Coverage: {coverage_str}")
    
    # Check coverage quality
    min_freq = min([r[0] for r in covered_ranges])
    max_freq = max([r[1] for r in covered_ranges])
    
    coverage_ok = True
    if min_freq > animal_low:
        print(f"   ⚠️  WARNING: Missing {animal_low}-{min_freq:.0f} Hz!")
        coverage_ok = False
    if max_freq < animal_high:
        print(f"   ⚠️  WARNING: Missing {max_freq:.0f}-{animal_high} Hz!")
        coverage_ok = False
    if coverage_ok:
        print(f"   ✅ FULL COVERAGE ({min_freq:.0f}-{max_freq:.0f} Hz)")
    
    print()

print("\n" + "=" * 80)
print("ISSUE DETECTED:")
print("=" * 80)
print("❌ FROG (225-504 Hz): Levels [5,6] cover 344-1378 Hz")
print("   Missing: 225-344 Hz (needs Approximation cA OR add L7!)")
print()
print("The approximation coefficients (cA) hold 0-344.5 Hz,")
print("but they're never used in ANIMAL_LEVEL_MAP!")
