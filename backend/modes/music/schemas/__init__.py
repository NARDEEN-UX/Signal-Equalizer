from pydantic import BaseModel
from typing import List

class MusicEqualizationRequest(BaseModel):
    scales: List[float]
    use_wavelet: bool = False
