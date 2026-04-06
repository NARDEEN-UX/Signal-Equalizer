"""
Verify 7-level animal wavelet configuration covers all frequencies
"""
SAMPLE_RATE = 44100

ANIMAL_RANGES = {
    'frog': {'low': 225, 'high': 504},
    'birds': {'low': 4255, 'high': 11025},
    'dog': {'low': 504, 'high': 1943},
    'cat': {'low': 1943, 'high': 4255}
}

# NEW: 7-level configuration
ANIMAL_LEVEL_MAP = {
    "frog": [6, 7, "cA"],
    "birds": [1, 2, 3],
    "dog": [4, 5, 6],
    "cat": [2, 3, 4]
}

def detail_level_band(lv, sample_rate):
    high = sample_rate / (2 ** lv)
    low = sample_rate / (2 ** (lv + 1))
    return low, high

def approx_level_band(level, sample_rate):
    return 0, sample_rate / (2 ** level)

print("\n" + "=" * 90)
print("7-LEVEL WAVELET CONFIGURATION VERIFICATION")
print("=" * 90)

print("\n📊 WAVELET LEVEL FREQUENCY RANGES (44.1 kHz):")
print("-" * 90)
for lv in range(1, 8):
    low, high = detail_level_band(lv, SAMPLE_RATE)
    print(f"  L{lv}: {low:7.1f} - {high:7.1f} Hz")
low, high = approx_level_band(7, SAMPLE_RATE)
print(f"  cA: {low:7.1f} - {high:7.1f} Hz")

print("\n🔊 ANIMAL FREQUENCY COVERAGE:")
print("-" * 90)

all_ok = True
for animal in ['frog', 'birds', 'dog', 'cat']:
    levels = ANIMAL_LEVEL_MAP[animal]
    animal_low = ANIMAL_RANGES[animal]['low']
    animal_high = ANIMAL_RANGES[animal]['high']
    
    covered_ranges = []
    coverage_parts = []
    
    for lv in levels:
        if lv == "cA":
            low, high = approx_level_band(7, SAMPLE_RATE)
            coverage_parts.append(f"cA:{low:.0f}-{high:.0f}")
        else:
            low, high = detail_level_band(lv, SAMPLE_RATE)
            coverage_parts.append(f"L{lv}:{low:.0f}-{high:.0f}")
        covered_ranges.append((low, high))
    
    min_freq = min([r[0] for r in covered_ranges])
    max_freq = max([r[1] for r in covered_ranges])
    
    print(f"\n  {animal.upper()}: {animal_low}-{animal_high} Hz")
    print(f"  Levels: {levels}")
    print(f"  Covers: {' + '.join(coverage_parts)}")
    print(f"  Range:  {min_freq:.0f}-{max_freq:.0f} Hz", end="")
    
    # Check
    if min_freq <= animal_low and max_freq >= animal_high:
        print(" ✅ FULL COVERAGE")
    else:
        print(" ❌ INCOMPLETE")
        if min_freq > animal_low:
            print(f"    Missing LOW:  {animal_low}-{min_freq:.0f} Hz")
            all_ok = False
        if max_freq < animal_high:
            print(f"    Missing HIGH: {max_freq:.0f}-{animal_high} Hz")
            all_ok = False

print("\n" + "=" * 90)
if all_ok:
    print("✅ ALL ANIMALS HAVE FULL FREQUENCY COVERAGE!")
    print("The 7-level wavelet configuration is CORRECT! 🎉")
else:
    print("❌ SOME ANIMALS HAVE MISSING FREQUENCIES - FIX NEEDED!")
print("=" * 90 + "\n")
