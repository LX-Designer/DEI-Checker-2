import logging
from flask import Flask, request, jsonify, render_template  # Import modules for handling requests and JSON responses.
from werkzeug.utils import secure_filename
import os
import docx
import PyPDF2
import spacy
import sqlite3

logging.basicConfig(                                                # Configure the logging module.
    level=logging.DEBUG,  # Set to INFO or ERROR for production
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("app.log"),  # Log to a file
        logging.StreamHandler()         # Log to console
    ]
)
logger = logging.getLogger(__name__)                                # Get a logger object.

app = Flask(__name__)                                               # Create a Flask app.  

nlp = spacy.load("en_core_web_sm")                                  # Load the spaCy model.

UPLOAD_FOLDER = 'uploads'                                # Define the upload folder.
ALLOWED_EXTENSIONS = {'txt', 'docx', 'pdf'}              # Define the allowed file extensions.
MAX_CONTENT_LENGTH = 10 * 1024 * 1024                    # Define the maximum file size (10 MB).

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER                     # Set the upload folder in the app configuration.
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH           # Set the maximum content length in the app configuration.

os.makedirs(UPLOAD_FOLDER, exist_ok=True)                       # Create the upload folder if it does not exist.

def allowed_file(filename):                                                             # Function to check if the file extension is allowed.
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS # Check if the file extension is allowed.

def extract_text_from_docx(file_path):                                  # Function to extract text from a .docx file
    doc = docx.Document(file_path)                                      # Load the .docx file
    return '\n'.join([paragraph.text for paragraph in doc.paragraphs])  # Extract text from the paragraphs

def extract_text_from_pdf(file_path):                           # Function to extract text from a .pdf file
    text = ''                                                   # Initialize a variable to store the text
    with open(file_path, 'rb') as f:                            # Open the .pdf file in read binary mode
        pdf_reader = PyPDF2.PdfReader(f)                        # Create a PdfReader object
        for page in pdf_reader.pages:                           # Iterate over the pages in the .pdf file
            text += page.extract_text()                         # Extract text from the page
    return text                                                 # Return the extracted text

def get_problematic_terms():                                        # Function to fetch problematic terms and feedback from the database
    conn = sqlite3.connect('terms.db')                              # Connect to the database
    cursor = conn.cursor()                                          # Create a cursor object
    cursor.execute("SELECT term, feedback FROM problematic_terms")  # Execute a query
    terms = cursor.fetchall()                                       # Fetch all the results
    conn.close()                                                    # Close the connection          
    return {term: feedback for term, feedback in terms}             # Return a dictionary of terms and feedback

def get_topics():                                                   # Function to fetch topics and associated terms from the database
    conn = sqlite3.connect('terms.db')                              # Connect to the database
    cursor = conn.cursor()                                          # Create a cursor object
    cursor.execute("SELECT topic, terms FROM topics")               # Execute a query
    topics = cursor.fetchall()                                      # Fetch all the results
    conn.close()                                                    # Close the connection  
    return {topic: terms.split(", ") for topic, terms in topics}    # Return a dictionary of topics and associated terms


@app.route("/")                                                     # Define a route for the landing page.
def input_text():                                                   # Define a function to render the index.html template.
    logger.info("Landing page accessed.")                           # Log a message.
    return render_template("index.html")                            # Render the index.html template.


@app.route('/analyze', methods=['POST'])                            # Define a route for the analyze endpoint.
def analyze():
    try:
        logger.info("Analyze endpoint accessed.")
        data = request.get_json()

        if not data or 'text' not in data:
            logger.warning("Invalid request: No text provided.")
            return jsonify({"error": "No text provided. Please enter some text."}), 400

        input_text = data['text']
        logger.info(f"Input text: {input_text}")

        terms_feedback = get_problematic_terms()
        topics = get_topics()

        analysis_results = []
        highlighted_text = input_text

        for term, feedback in terms_feedback.items():
            if term.lower() in input_text.lower():
                logger.info(f"Problematic term found: {term}")
                analysis_results.append({"term": term, "feedback": feedback})
                highlighted_text = highlighted_text.replace(
                    term, f'<span class="highlight">{term}</span>'
                )

        for topic, terms in topics.items():
            topic_count = sum(1 for term in terms if term.lower() in input_text.lower())
            if topic_count >= 2:
                analysis_results.append({
                    "topic": topic,
                    "feedback": f"Potential discussion about {topic}. Please review the content for sensitivity."
                })

        return jsonify({"input_text": highlighted_text, "analysis": analysis_results})

    except Exception as e:
        logger.error(f"Error in analyze route: {str(e)}")
        return jsonify({"error": "An error occurred while processing the text."}), 500



@app.route('/upload', methods=['POST'])                                 # Define a route for the upload endpoint.
def upload_file():                                                      # Define a function to handle file uploads.
    logger.info("Received a file upload request.")
    if 'file' not in request.files:                                     # Check if the request contains a file part.
        logger.warning("No file part in the request.")
        return jsonify({"error": "No file part in the request. Please select a file."}), 400

    file = request.files['file']                                        # Get the file from the request.
    if file.filename == '':                                             # Check if the file name is empty.
        logger.warning("No file selected for upload.")
        return jsonify({"error": "No file selected. Please choose a file to upload."}), 400

    if not file or not allowed_file(file.filename):                     # Check if the file is empty or the file extension is not allowed.
        logger.warning(f"Invalid file type: {file.filename}")
        return jsonify({"error": "Invalid file type. Only .txt, .docx, and .pdf files are supported."}), 400

    try:                                                                # Try block to handle file processing.
        filename = secure_filename(file.filename)                       # Secure the file name.
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename) # Create the file path.

        logger.info(f"Saving file in chunks to: {file_path}")           
        with open(file_path, 'wb') as f:                                # Open the file in write binary mode.
            for chunk in file.stream:                                   # Iterate over the file stream.
                f.write(chunk)                                          # Write the file chunk to the file path.

        logger.info(f"File saved: {file_path}")                         # Log the saved file path.        

        if filename.endswith('.docx'):                                  # Check if the file is a .docx file.
            extracted_text = extract_text_from_docx(file_path)          # Extract text from the .docx file.
        elif filename.endswith('.pdf'):                                 # Check if the file is a .pdf file.
            extracted_text = extract_text_from_pdf(file_path)           # Extract text from the .pdf file.
        else:  # For .txt files                                         # Check if the file is a .txt file.
            with open(file_path, 'r', encoding='utf-8') as f:           # Open the file in read mode.
                extracted_text = f.read()                               # Read the contents of the file.     

        terms_feedback = get_problematic_terms()                # Fetch problematic terms and feedback from the database.
        analysis_results = []                                   # Initialize a list to store the analysis results.

        for term, feedback in terms_feedback.items():           # Iterate over the terms and feedback.
            if term in extracted_text:                          # Check if the term is present in the extracted text.
                analysis_results.append({                       # Add the term and feedback to the analysis results.
                    "term": term,                               # Store the term.
                    "feedback": feedback                        # Store the feedback.
                })

        return jsonify({                                # Return the analysis results as JSON.
            "input_text": extracted_text,               # Return the extracted text.
            "analysis": analysis_results                # Return the analysis results (term + feedback).
        })

    except Exception as e:
        logger.error(f"Error while processing file: {str(e)}")
        return jsonify({"error": f"An error occurred while processing the file: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True)  # Run the app in debug mode.
