from flask import Flask
from flask_cors import CORS
from signalRoutes import fft_bp

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


app.register_blueprint(fft_bp)


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
