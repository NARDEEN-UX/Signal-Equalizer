from pydantic import BaseModel
from typing import List

class AnimalEqualizationRequest(BaseModel):
    scales: List[float]
    use_wavelet: bool = False
