from pydantic import BaseModel
from typing import List, Tuple

class GenericSubdivision(BaseModel):
    low_freq: float
    high_freq: float
    label: str
    
class GenericEqualizationRequest(BaseModel):
    scales: List[float]
    subdivisions: List[GenericSubdivision]
    use_wavelet: bool = False
