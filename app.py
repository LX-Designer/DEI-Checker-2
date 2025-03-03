import logging
from flask import Flask, request, jsonify, render_template  # Import modules for handling requests and JSON responses.
from werkzeug.utils import secure_filename
import os
import docx
import PyPDF2
import nltk
import sqlite3
import re

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

# Download necessary NLTK data
nltk_data_downloaded = False
try:
    nltk.download('punkt', quiet=True)
    nltk.download('wordnet', quiet=True)
    nltk.download('averaged_perceptron_tagger', quiet=True)
    nltk_data_downloaded = True
    logger.info("NLTK data successfully downloaded")
except Exception as e:
    logger.error(f"Error downloading NLTK data: {str(e)}")
    logger.warning("Application will run with limited functionality")

UPLOAD_FOLDER = 'uploads'                                # Define the upload folder.
ALLOWED_EXTENSIONS = {'txt', 'docx', 'pdf'}              # Define the allowed file extensions.
MAX_CONTENT_LENGTH = 10 * 1024 * 1024                    # Define the maximum file size (10 MB).

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER                     # Set the upload folder in the app configuration.
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH           # Set the maximum content length in the app configuration.

os.makedirs(UPLOAD_FOLDER, exist_ok=True)                       # Create the upload folder if it does not exist.

def allowed_file(filename):                                                             # Function to check if the file extension is allowed.
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS # Check if the file extension is allowed.

def extract_text_from_docx(file_path):
    try:
        doc = docx.Document(file_path)
        text = '\n'.join([paragraph.text for paragraph in doc.paragraphs])
        return text
    except Exception as e:
        logger.error(f"Error extracting text from DOCX file {file_path}: {str(e)}")
        raise Exception(f"Could not read DOCX file. It may be corrupted or in an unsupported format: {str(e)}")

def extract_text_from_pdf(file_path):
    try:
        text = ''
        with open(file_path, 'rb') as f:
            try:
                pdf_reader = PyPDF2.PdfReader(f)
                if len(pdf_reader.pages) == 0:
                    raise Exception("PDF has no pages")
                    
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text
                
                if not text.strip():
                    raise Exception("No text content could be extracted from PDF")
                    
                return text
            except Exception as e:
                logger.error(f"Error reading PDF content: {str(e)}")
                raise Exception(f"Could not extract text from PDF: {str(e)}")
    except Exception as e:
        logger.error(f"Error opening PDF file {file_path}: {str(e)}")
        raise Exception(f"Could not open PDF file: {str(e)}")

def get_problematic_terms():
    """
    Function to fetch problematic terms and feedback from the database.
    Returns a list of term dictionaries or raises an exception if the database operation fails.
    """
    try:
        conn = sqlite3.connect('terms.db')
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT t.term, t.pattern, t.feedback, c.name, s.name 
                FROM problematic_terms t
                LEFT JOIN categories c ON t.category_id = c.id
                LEFT JOIN sources s ON t.source_id = s.id
            """)
            terms = cursor.fetchall()
            
            if not terms:
                logger.warning("No problematic terms found in database")
            
            return [
                {
                    "term": term,
                    "pattern": pattern or r'\b' + re.escape(term) + r'\b',
                    "feedback": feedback,
                    "category": category,
                    "source": source
                }
                for term, pattern, feedback, category, source in terms
            ]
        except sqlite3.Error as query_error:
            logger.error(f"SQL error in get_problematic_terms: {str(query_error)}")
            raise
        finally:
            conn.close()
    except sqlite3.Error as conn_error:
        logger.error(f"Database connection error in get_problematic_terms: {str(conn_error)}")
        raise Exception(f"Failed to retrieve problematic terms from database: {str(conn_error)}")

def get_topics():
    """
    Function to fetch topics and associated terms from the database.
    Returns a dictionary of topics with their terms or raises an exception if the database operation fails.
    """
    try:
        conn = sqlite3.connect('terms.db')
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT topic, terms FROM topics")
            topics = cursor.fetchall()
            
            if not topics:
                logger.warning("No topics found in database")
                return {}
                
            return {topic: terms.split(", ") for topic, terms in topics}
        except sqlite3.Error as query_error:
            logger.error(f"SQL error in get_topics: {str(query_error)}")
            raise
        finally:
            conn.close()
    except sqlite3.Error as conn_error:
        logger.error(f"Database connection error in get_topics: {str(conn_error)}")
        raise Exception(f"Failed to retrieve topics from database: {str(conn_error)}")

def analyze_term_context(text, match, window_size=5):
    """
    Analyze the context around a matched term to determine if it's likely to be problematic in this context.
    Returns a confidence score (0-1) and contextual information.
    """
    try:
        start, end = match.span()
        
        # Get the sentence containing the term
        if nltk_data_downloaded:
            try:
                sentences = nltk.sent_tokenize(text)
                term_sentence = ""
                for sentence in sentences:
                    if start >= text.find(sentence) and end <= text.find(sentence) + len(sentence):
                        term_sentence = sentence
                        break
                
                if not term_sentence:
                    term_sentence = text[max(0, start - 50):min(len(text), end + 50)]
            except Exception as nltk_error:
                logger.warning(f"NLTK sentence tokenization error: {str(nltk_error)}")
                term_sentence = text[max(0, start - 50):min(len(text), end + 50)]
        else:
            # Fallback if NLTK data is not available
            term_sentence = text[max(0, start - 50):min(len(text), end + 50)]
        
        # Get words around the term
        if nltk_data_downloaded:
            try:
                words = nltk.word_tokenize(text)
                term_position = -1
                for i, word in enumerate(words):
                    word_start = text.find(word, max(0, start-50), min(len(text), end+50))
                    if word_start != -1 and start >= word_start and end <= word_start + len(word):
                        term_position = i
                        break
                
                if term_position == -1:
                    return 1.0, "Could not analyze context"
                
                # Get context words
                start_pos = max(0, term_position - window_size)
                end_pos = min(len(words), term_position + window_size + 1)
                context_words = words[start_pos:term_position] + words[term_position+1:end_pos]
            except Exception as nltk_error:
                logger.warning(f"NLTK word tokenization error: {str(nltk_error)}")
                # Fallback to simple word splitting
                context_words = term_sentence.split()
        else:
            # Fallback if NLTK data is not available
            context_words = term_sentence.split()
        
        # List of words that might indicate benign context
        benign_context_indicators = [
            'quote', 'quotes', 'quoted', 'quoting', 
            'example', 'examples', 'exemplifies',
            'reference', 'references', 'referenced',
            'citation', 'citations', 'cited',
            'definition', 'defines', 'defined',
            'mention', 'mentions', 'mentioned',
            'discuss', 'discusses', 'discussed', 'discussing', 'discussion'
        ]
        
        # Check if any benign indicators are in the context
        context_text = ' '.join(context_words).lower()
        for indicator in benign_context_indicators:
            if indicator in context_text:
                return 0.5, f"May be in benign context ('{indicator}' found nearby)"
        
        # Default to high confidence if no benign indicators found
        return 1.0, "No benign context indicators found"
    except Exception as e:
        logger.error(f"Error in analyze_term_context: {str(e)}")
        return 1.0, "Error analyzing context"

def analyze_topics(text, topics_data):
    """
    Analyze the text to identify prevalent topics based on the presence of topic-related terms.
    Returns a dictionary of topics with their relevance scores.
    """
    text_lower = text.lower()
    topic_matches = {}
    
    for topic, terms in topics_data.items():
        matches = 0
        for term in terms:
            # Count how many times each term appears in the text
            term_lower = term.lower()
            # Use word boundaries to avoid partial matches
            pattern = r'\b' + re.escape(term_lower) + r'\b'
            term_matches = len(re.findall(pattern, text_lower, re.IGNORECASE))
            matches += term_matches
        
        if matches > 0:
            # Calculate a simple relevance score based on number of matches and text length
            relevance = min(1.0, matches / (len(text_lower.split()) / 50))
            topic_matches[topic] = {
                "matches": matches,
                "relevance": relevance
            }
    
    # Sort topics by relevance
    return {k: v for k, v in sorted(topic_matches.items(), 
                                    key=lambda item: item[1]['relevance'], 
                                    reverse=True)}

@app.route("/")                                                     # Define a route for the landing page.
def input_text():                                                   # Define a function to render the index.html template.
    logger.info("Landing page accessed.")                           # Log a message.
    return render_template("index.html")                            # Render the index.html template.


@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        logger.info("Analyze endpoint accessed.")
        data = request.get_json()

        # Validate input
        if not data:
            logger.warning("No JSON data received")
            return jsonify({"error": "No data provided"}), 400

        if 'text' not in data or not isinstance(data['text'], str):
            logger.warning("Invalid or missing text field")
            return jsonify({"error": "Invalid text format"}), 400

        input_text = data['text'].strip()
        if not input_text:
            logger.warning("Empty text received")
            return jsonify({"error": "Please enter some text to analyze"}), 400

        # Verify database before attempting to use it
        db_ok, db_error = verify_database()
        if not db_ok:
            logger.error(f"Database verification failed during analyze: {db_error}")
            return jsonify({"error": f"Database error: {db_error}"}), 500

        # Get terms from database
        try:
            terms_data = get_problematic_terms()
            if not terms_data:
                logger.warning("No terms found in database")
                return jsonify({"error": "No analysis terms available in the database. Analysis cannot be performed."}), 500
                
            topics_data = get_topics()
        except sqlite3.Error as db_error:
            logger.error(f"Database error: {str(db_error)}")
            return jsonify({"error": f"Database error: {str(db_error)}"}), 500
        except Exception as term_error:
            logger.error(f"Error fetching terms: {str(term_error)}")
            return jsonify({"error": f"Error fetching analysis terms: {str(term_error)}"}), 500

        # Process text
        analysis_results = []
        highlighted_text = input_text

        try:
            # Process problematic terms
            for idx, term_info in enumerate(terms_data):
                pattern = term_info["pattern"]
                try:
                    regex = re.compile(pattern, re.IGNORECASE)
                except re.error as regex_compile_error:
                    logger.warning(f"Invalid regex pattern: {pattern}. Error: {str(regex_compile_error)}")
                    continue  # Skip this term if the pattern is invalid
                
                for match in regex.finditer(input_text):
                    term_id = f"term-{idx}-{len(analysis_results)}"
                    matched_term = match.group()
                    
                    # Analyze the context of the match
                    try:
                        confidence, context_note = analyze_term_context(input_text, match)
                    except Exception as context_error:
                        logger.warning(f"Error analyzing context: {str(context_error)}")
                        confidence, context_note = 1.0, "Context analysis failed"
                    
                    analysis_results.append({
                        "id": term_id,
                        "term": matched_term,
                        "feedback": term_info["feedback"],
                        "category": term_info["category"] or "General",
                        "source": term_info["source"] or "Internal",
                        "confidence": confidence,
                        "context_note": context_note
                    })
                    
                    # Create highlight span with data attributes
                    # Add confidence class based on confidence level
                    confidence_class = "high-confidence"
                    if confidence < 0.7:
                        confidence_class = "medium-confidence"
                    if confidence < 0.3:
                        confidence_class = "low-confidence"
                        
                    highlight_span = f'<span class="highlight {confidence_class}" data-id="{term_id}" data-feedback="{term_info["feedback"]}" data-category="{term_info["category"] or "General"}" data-source="{term_info["source"] or "Internal"}" data-confidence="{confidence}" data-context="{context_note}">{matched_term}</span>'
                    
                    # Replace this occurrence only
                    start_pos = match.start()
                    end_pos = match.end()
                    highlighted_text = highlighted_text[:start_pos] + highlight_span + highlighted_text[end_pos:]
                    
                    # Adjust input text to prevent overlapping highlights
                    input_text = input_text[:start_pos] + ' ' * len(matched_term) + input_text[end_pos:]
            
            # Analyze topics in the text
            try:
                topics_analysis = analyze_topics(data['text'], topics_data)
            except Exception as topics_error:
                logger.warning(f"Error analyzing topics: {str(topics_error)}")
                topics_analysis = {}  # Use empty dict if topic analysis fails

            return jsonify({
                "input_text": highlighted_text,
                "analysis": analysis_results,
                "topics": topics_analysis,
                "original_text": data['text']  # Include original text for report
            })

        except re.error as regex_error:
            logger.error(f"Regex error: {str(regex_error)}")
            return jsonify({"error": f"Error in text processing: {str(regex_error)}"}), 500
        except Exception as analysis_error:
            logger.error(f"Error in text analysis: {str(analysis_error)}")
            return jsonify({"error": f"Error during text analysis: {str(analysis_error)}"}), 500

    except Exception as e:
        logger.error(f"Unexpected error in analyze route: {str(e)}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


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

        logger.info(f"Saving file in chunks to: {file_path}")           
        with open(file_path, 'wb') as f:                                
            for chunk in file.stream:                                   
                f.write(chunk)                                          

        logger.info(f"File saved: {file_path}")

        # Extract text based on file type
        try:
            if filename.endswith('.docx'):                                  
                extracted_text = extract_text_from_docx(file_path)          
            elif filename.endswith('.pdf'):                                 
                extracted_text = extract_text_from_pdf(file_path)           
            else:  # For .txt files                                         
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:           
                        extracted_text = f.read()
                except UnicodeDecodeError:
                    # Try a different encoding if utf-8 fails
                    with open(file_path, 'r', encoding='latin-1') as f:
                        extracted_text = f.read()
                        
            if not extracted_text or len(extracted_text.strip()) == 0:
                logger.warning(f"Extracted empty text from file: {filename}")
                return jsonify({"error": "Could not extract text from the file. The file may be empty or in an unsupported format."}), 400
                
        except Exception as extract_error:
            logger.error(f"Error extracting text from file: {str(extract_error)}")
            return jsonify({"error": f"Failed to extract text from the file: {str(extract_error)}"}), 500

        # Verify database before attempting to use it
        db_ok, db_error = verify_database()
        if not db_ok:
            logger.error(f"Database verification failed during upload: {db_error}")
            return jsonify({"error": f"Database error: {db_error}"}), 500

        # Check if database exists and fetch terms
        try:
            terms_data = get_problematic_terms()
            if not terms_data:
                logger.warning("No terms found in database")
                return jsonify({"error": "No analysis terms available in the database. Analysis cannot be performed."}), 500
                
            topics_data = get_topics()
            
        except sqlite3.Error as db_error:
            logger.error(f"Database error: {str(db_error)}")
            return jsonify({"error": f"Database error: {str(db_error)}"}), 500
        except Exception as term_error:
            logger.error(f"Error fetching terms: {str(term_error)}")
            return jsonify({"error": f"Error fetching analysis terms: {str(term_error)}"}), 500

        # Process text and find matches
        analysis_results = []                                   
        highlighted_text = extracted_text
        input_text = extracted_text

        try:
            for idx, term_info in enumerate(terms_data):
                pattern = term_info["pattern"]
                try:
                    regex = re.compile(pattern, re.IGNORECASE)
                except re.error:
                    logger.warning(f"Invalid regex pattern: {pattern}")
                    continue  # Skip this term if the pattern is invalid
                
                for match in regex.finditer(input_text):
                    term_id = f"term-{idx}-{len(analysis_results)}"
                    matched_term = match.group()
                    
                    # Analyze the context of the match
                    try:
                        confidence, context_note = analyze_term_context(input_text, match)
                    except Exception as context_error:
                        logger.warning(f"Error analyzing context: {str(context_error)}")
                        confidence, context_note = 1.0, "Context analysis failed"
                    
                    analysis_results.append({
                        "id": term_id,
                        "term": matched_term,
                        "feedback": term_info["feedback"],
                        "category": term_info["category"] or "General",
                        "source": term_info["source"] or "Internal",
                        "confidence": confidence,
                        "context_note": context_note
                    })
                    
                    # Create highlight span with data attributes
                    confidence_class = "high-confidence"
                    if confidence < 0.7:
                        confidence_class = "medium-confidence"
                    if confidence < 0.3:
                        confidence_class = "low-confidence"
                        
                    highlight_span = f'<span class="highlight {confidence_class}" data-id="{term_id}" data-feedback="{term_info["feedback"]}" data-category="{term_info["category"] or "General"}" data-source="{term_info["source"] or "Internal"}" data-confidence="{confidence}" data-context="{context_note}">{matched_term}</span>'
                    
                    # Replace this occurrence only
                    start_pos = match.start()
                    end_pos = match.end()
                    highlighted_text = highlighted_text[:start_pos] + highlight_span + highlighted_text[end_pos:]
                    
                    # Adjust input text to prevent overlapping highlights
                    input_text = input_text[:start_pos] + ' ' * len(matched_term) + input_text[end_pos:]

            # Analyze topics in the extracted text
            try:
                topics_analysis = analyze_topics(extracted_text, topics_data)
            except Exception as topics_error:
                logger.warning(f"Error analyzing topics: {str(topics_error)}")
                topics_analysis = {}  # Use empty dict if topic analysis fails

            return jsonify({
                "input_text": highlighted_text,
                "analysis": analysis_results,
                "topics": topics_analysis,
                "original_text": extracted_text  # Include original text for report
            })

        except Exception as analysis_error:
            logger.error(f"Error analyzing text: {str(analysis_error)}")
            return jsonify({"error": f"Error during text analysis: {str(analysis_error)}"}), 500

    except Exception as e:
        logger.error(f"Error while processing file: {str(e)}")
        return jsonify({"error": f"An error occurred while processing the file: {str(e)}"}), 500

def verify_database():
    """
    Verify that the database exists and has the required tables.
    Returns a tuple (success, error_message).
    """
    if not os.path.exists('terms.db'):
        return False, "Database file 'terms.db' not found"
    
    try:
        conn = sqlite3.connect('terms.db')
        cursor = conn.cursor()
        
        # Check if the problematic_terms table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='problematic_terms'")
        if not cursor.fetchone():
            conn.close()
            return False, "Required table 'problematic_terms' not found in database"
        
        # Check if the topics table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='topics'")
        if not cursor.fetchone():
            conn.close()
            return False, "Required table 'topics' not found in database"
        
        # Check if there's data in the problematic_terms table
        cursor.execute("SELECT COUNT(*) FROM problematic_terms")
        if cursor.fetchone()[0] == 0:
            conn.close()
            return False, "No terms found in the 'problematic_terms' table"
        
        conn.close()
        return True, ""
    except sqlite3.Error as e:
        return False, f"Database error: {str(e)}"
    except Exception as e:
        return False, f"Error verifying database: {str(e)}"

# Verify database on startup
db_ok, db_error = verify_database()
if not db_ok:
    logger.error(f"Database verification failed: {db_error}")
    logger.warning("Application may not function correctly without a properly initialized database")
else:
    logger.info("Database verification successful")

if __name__ == "__main__":
    app.run(debug=True)  # Run the app in debug mode.
