from pydantic import BaseModel
from typing import List

class ECGEqualizationRequest(BaseModel):
    scales: List[float]
    use_wavelet: bool = False
