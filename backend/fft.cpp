#include <vector>
#include <complex>
#include <cmath>
#include <algorithm>

// #ifndef M_PI
#define M_PI 3.14159265358979323846
// #endif



using namespace std;

// ------------------------------------------------------------
// 1. Recursive FFT (same logic as your Python version)
// ------------------------------------------------------------
vector<complex<double>> FFT(const vector<complex<double>>& x) {
    int M = x.size();
    if (M <= 1)
        return x;

    vector<complex<double>> even(M / 2), odd(M / 2);
    for (int i = 0; i < M / 2; ++i) {
        even[i] = x[2 * i];
        odd[i]  = x[2 * i + 1];
    }

    auto FFT_even = FFT(even);
    auto FFT_odd  = FFT(odd);

    vector<complex<double>> X(M);
    for (int k = 0; k < M / 2; ++k) {
        complex<double> factor = exp(complex<double>(0, -2.0 * M_PI * k / M)) * FFT_odd[k];
        X[k]         = FFT_even[k] + factor;
        X[k + M / 2] = FFT_even[k] - factor;
    }

    return X;
}

// ------------------------------------------------------------
// 2. Chunked FFT — equivalent to your Python fft(data, fs)
// ------------------------------------------------------------
struct FFTResult {
    vector<vector<complex<double>>> all_X;
    vector<vector<double>> magnitudes;
    vector<double> freqs;
};

FFTResult fft_chunked(const vector<double>& data, double fs) {
    int len = data.size();

    // convert to nearest power of 2
    int N = pow(2, floor(log2(len)));

    // Create frequency array
    vector<double> freqs(N);
    for (int k = 0; k < N; k++) {
        if (k < N / 2)
            freqs[k] = fs * k / N;
        else
            freqs[k] = fs * (k - N) / N;
    }

    vector<vector<complex<double>>> all_X;
    vector<vector<double>> magnitudes;

    // Split into chunks
    for (int i = 0; i < len; i += N) {
        vector<complex<double>> chunk(N);

        for (int j = 0; j < N; j++) {
            if (i + j < len)
                chunk[j] = complex<double>(data[i + j], 0.0);
            else
                chunk[j] = complex<double>(0.0, 0.0);
        }

        // FFT
        auto X = FFT(chunk);

        // Magnitudes for k=0 ... N/2-1
        vector<double> mag(N / 2);
        for (int k = 0; k < N / 2; k++)
            mag[k] = abs(X[k]) / N;

        all_X.push_back(X);
        magnitudes.push_back(mag);
    }

    return {all_X, magnitudes, vector<double>(freqs.begin(), freqs.begin() + N/2)};
}

// #include <pybind11/pybind11.h>
// #include <pybind11/stl.h>
// namespace py = pybind11;

// PYBIND11_MODULE(fftlib, m) {
//     py::class_<FFTResult>(m, "FFTResult")
//         .def_readonly("all_X", &FFTResult::all_X)
//         .def_readonly("magnitudes", &FFTResult::magnitudes)
//         .def_readonly("freqs", &FFTResult::freqs);

//     m.def("fft_chunked", &fft_chunked, "Chunked FFT");
// }

