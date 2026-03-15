<div align="center">

# **Signal Equalizer**
  <img width="1080" height="1080" alt="1" src="https://github.com/user-attachments/assets/74f43c7c-f2d0-4dc8-85c1-55d9753bf728" />

</div>

### A web application that allows users to load audio signals, `modify` specific **frequency** components using sliders, and `reconstruct` the altered signal in **real-time**.
</br>

It supports:
- a `generic equalizer` mode for custom frequency subdivisions
- three `customized` modes for separating and controlling elements in mixed audio signals (musical instruments, animal sounds, and human voices)
  
---

## **Generic Mode**:

 

- Divide the frequency range into custom subdivisions.
- Each subdivision has a slider to scale its magnitude (0–2).
- Subdivision settings can be saved and loaded from a file.
- Time, FFT, and spectrogram graphs update automatically





https://github.com/user-attachments/assets/91427f93-1873-4de9-835a-a38e3398f34b



---

## **Customized Mode:**

- **Description:** Controls the magnitude of different sounds in a mixed signal. Each slider corresponds to one sound and allows adjusting its gain (0–2 scale).

- **Manual Mode:** The effect is applied using an implemented FFT.

- **AI Mode:** A pretrained AI model applies the effect by detecting and isolating sounds automatically. 

- **Effect:** Time, FFT, and spectrogram graphs update automatically.

We have 3 modes that use 2 different AI models (for human and music sounds):

### 1) **Animal Sounds Mode:**

- Adjusts 4 animal sounds:
  - Cat
  - Wolf
  - Bird
  - Frog




https://github.com/user-attachments/assets/f896bb39-9307-4f8c-adff-dff8a4cfd6a4



--- 

### 2) **Music Sounds Mode:**

- Adjusts 4 musical instruments:
  - Drums
  - Piano 
  - Guitar 
  - Violin
    



https://github.com/user-attachments/assets/a0f34522-0be7-40fd-bae8-bc317d169b7d



---

### 3) **Human Sounds Mode:**

- Adjusts 4 human voice types:
  - Deep Man
  - Man 
  - Old Man 
  - Woman
    


https://github.com/user-attachments/assets/1bb92d0d-6615-4512-9ea2-6177e2c02e57




---

### Technologies Used

| Layer | Tools | Description | Model Source |
|:------|:-------------------|:-------------|:--------------------|
| **Frontend** | React.js, react-plotly.js | Interactive UI for real-time signal visualization and user controls. | — |
| **Backend** | Flask (Python), Numba |- Handles signal processing, AI model inference, and data communication. </br> - Numba is for faster fft in run-time. | — |
| **AI / ML Models** | Pytorch | Pretrained models for sounds isolation. |[human model(MultiDecoderDPRNN)](https://huggingface.co/JunzheJosephZhu/MultiDecoderDPRNN), [music model(DEMUCS)](https://github.com/facebookresearch/demucs)
| **FFT** | Numpy | implemented fft algorithm (Iterative Cooley-Tukey)|— |


## 👥 Contributors
| [Nayera Sherif](https://github.com/Nayera5) | [Nada Hesham](https://github.com/Nada-Hesham249) | [Shahd Ayman](https://github.com/Shahd-Ayman5) | [Nada Hassan](https://github.com/Nadahassan147) |
|-------------------------------|---------------------------|-----------------------------------|-------------------------------|
