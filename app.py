from flask import Flask, request, jsonify, render_template  # Import modules for handling requests and JSON responses.
from werkzeug.utils import secure_filename
import os
import docx
import PyPDF2

app = Flask(__name__)  # Create the Flask app.

# Define a dictionary of problematic terms and their feedback.
problematic_terms = {
    "chairman": "Consider using 'chairperson' instead.",
    "fireman": "Consider using 'firefighter' instead.",
    "mankind": "Consider using 'humankind' instead."
}

@app.route("/")  # Root endpoint.
def input_text():
    return render_template("index.html")  # Render and return the index.html template.

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    input_text = data['text']

    # Example problematic terms with feedback
    terms_feedback = {
        "chairman": "Use 'chairperson' instead.",
        "fireman": "Use 'firefighter' instead.",
        "stewardess": "Use 'flight attendant' instead."
    }

    analysis_results = []

    # Tokenize text and check for problematic terms
    for term, feedback in terms_feedback.items():
        if term in input_text:
            analysis_results.append({
                "term": term,
                "feedback": feedback
            })

    return jsonify({
        "input_text": input_text,
        "analysis": analysis_results
    })

# Add endpoint for handling file uploads
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'docx', 'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_docx(file_path):
    doc = docx.Document(file_path)
    return '\n'.join([paragraph.text for paragraph in doc.paragraphs])

def extract_text_from_pdf(file_path):
    text = ''
    with open(file_path, 'rb') as f:
        pdf_reader = PyPDF2.PdfReader(f)
        for page in pdf_reader.pages:
            text += page.extract_text()
    return text

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        # Extract text based on file type
        try:
            if filename.endswith('.docx'):
                extracted_text = extract_text_from_docx(file_path)
            elif filename.endswith('.pdf'):
                extracted_text = extract_text_from_pdf(file_path)
            else:  # For .txt files
                with open(file_path, 'r', encoding='utf-8') as f:
                    extracted_text = f.read()
        except Exception as e:
            return jsonify({"error": f"Error processing file: {e}"}), 500

        # Analyze the extracted text
        terms_feedback = {
            "chairman": "Use 'chairperson' instead.",
            "fireman": "Use 'firefighter' instead.",
            "stewardess": "Use 'flight attendant' instead."
        }
        analysis_results = []

        for term, feedback in terms_feedback.items():
            if term in extracted_text:
                analysis_results.append({
                    "term": term,
                    "feedback": feedback
                })

        return jsonify({
            "input_text": extracted_text,
            "analysis": analysis_results
        })

    return jsonify({"error": "File type not allowed"}), 400

if __name__ == "__main__":
    app.run(debug=True)  # Run the app in debug mode.
