import logging
from flask import Flask, request, jsonify, render_template  # Import modules for handling requests and JSON responses.
from werkzeug.utils import secure_filename
import os
import docx
import PyPDF2
import spacy

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Set to INFO or ERROR for production
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("app.log"),  # Log to a file
        logging.StreamHandler()         # Log to console
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)  # Create the Flask app.

# initialise nlp
nlp = spacy.load("en_core_web_sm")

# Define a dictionary of problematic terms and their feedback.
problematic_terms = {
    "chairman": "Consider using 'chairperson' instead.",
    "fireman": "Consider using 'firefighter' instead.",
    "mankind": "Consider using 'humankind' instead."
}

@app.route("/")  # Root endpoint.
def input_text():
    logger.info("Landing page accessed.")
    return render_template("index.html")  # Render and return the index.html template.

@app.route('/analyze', methods=['POST'])
def analyze():
    logger.info("Analyze endpoint accessed.")
    data = request.get_json()
    logger.info(f"Received data: {data}")
    input_text = data['text']
    logger.info(f"Input text: {input_text}")

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
            logger.info(f"Problematic term found: {term}")
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
# Set maximum file size to 10MB
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 megabytes


app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

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
    logger.info("Received a file upload request.")
    if 'file' not in request.files:
        logger.warning("No file part in the request.")
        return jsonify({"error": "No file part in the request. Please select a file."}), 400

    file = request.files['file']
    if file.filename == '':
        logger.warning("No file selected for upload.")
        return jsonify({"error": "No file selected. Please choose a file to upload."}), 400

    if not file or not allowed_file(file.filename):
        logger.warning(f"Invalid file type: {file.filename}")
        return jsonify({"error": "Invalid file type. Only .txt, .docx, and .pdf files are supported."}), 400

    try:
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        # Save file in chunks
        logger.info(f"Saving file in chunks to: {file_path}")
        with open(file_path, 'wb') as f:
            for chunk in file.stream:
                f.write(chunk)

        logger.info(f"File saved: {file_path}")

        # Extract text based on file type
        if filename.endswith('.docx'):
            extracted_text = extract_text_from_docx(file_path)
        elif filename.endswith('.pdf'):
            extracted_text = extract_text_from_pdf(file_path)
        else:  # For .txt files
            with open(file_path, 'r', encoding='utf-8') as f:
                extracted_text = f.read()

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

    except Exception as e:
        logger.error(f"Error while processing file: {str(e)}")
        return jsonify({"error": f"An error occurred while processing the file: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)  # Run the app in debug mode.
