from flask import Flask, request, jsonify
from padelpy import from_smiles
import pandas as pd
from joblib import load
import os
import sklearn
from flask_cors import CORS


app = Flask(__name__)

CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["OPTIONS", "POST"],
        "allow_headers": ["Content-Type"]
    }
})

model_path = os.path.join(os.path.dirname(__file__), 'pipeline_voting.joblib')
clf = load(model_path)
clf = clf.named_steps['model']

required_descriptors = [
    'nN', 'nX', 'AATS2i', 'nBondsD', 'nBondsD2', 'C1SP2', 'C3SP2', 'SCH-5',
    'nHssNH', 'ndssC', 'nssNH', 'SdssC', 'SdS', 'mindO', 'mindS', 'minssS',
    'maxdssC', 'ETA_dAlpha_B', 'MDEN-23', 'n5Ring', 'nT5Ring', 'nHeteroRing',
    'n5HeteroRing', 'nT5HeteroRing', 'SRW5', 'SRW7', 'SRW9', 'WTPT-5'
]

@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json()
    smiles = data.get("compound")
    try:
        # descriptor_dict = from_smiles(smiles)
        # filtered = {key: descriptor_dict.get(key, 0.0) for key in required_descriptors}
        # df = pd.DataFrame([filtered])
        # prediction = clf.predict(df)
        prediction = [f"Hello There Flask running. {smiles}"]
        return jsonify({"prediction": prediction[0]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 5328))
    app.run(host="0.0.0.0", port=port, threaded=True)  # Added threaded