from pydantic import BaseModel
from typing import List

class HumanEqualizationRequest(BaseModel):
    scales: List[float]
    use_wavelet: bool = False
